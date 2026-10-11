import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerSheetHtml } from '../../../exam/documents'
import { FILE_EXTENSIONS, emptyAnswer, fileSafe, isAnswered, masterFromPaper } from '../../../exam/format'
import { SittingError } from '../../../exam/sitting'
import type { Sitting, SittingStatus } from '../../../exam/sitting'
import type { Answer, Answers, ExamPaper } from '../../../exam/types'
import { desktop } from '../../../platform/desktop'
import { actions, labStore } from '../../../state/labState'
import { AnswerInput } from '../AnswerInput'
import { BrandMark } from '../BrandMark'
import { LabWorkspace } from '../LabWorkspace'
import { QUESTION_TYPE_NAMES, formatClock, formatTime, plural, useNow } from '../shared'
import { loadDraft, saveDraft } from './ticket'

interface Props {
  sitting: Sitting
  onLeave(): void
}

const POLL_MS = 2500
const SAVE_DELAY_MS = 1500
const BENCH_CAPTURE_DELAY_MS = 400
/** The clock turns red for the last minutes. */
const WARNING_MS = 5 * 60_000

/** A student's sitting of an exam: the waiting room, the questions, the clock and handing in. */
export function ExamRunner({ sitting, onLeave }: Props) {
  const [exam, setExam] = useState<ExamPaper | null>(null)
  const [status, setStatus] = useState<SittingStatus | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [current, setCurrent] = useState(0)
  const [online, setOnline] = useState(true)
  const [unsaved, setUnsaved] = useState(false)
  const [message, setMessage] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [working, setWorking] = useState(false)
  const now = useNow()

  const answersRef = useRef<Answers>({})
  const examRef = useRef<ExamPaper | null>(null)
  const statusRef = useRef<SittingStatus | null>(null)
  /** Counts the changes to the answers; `savedRef` is the count the teacher's machine has. */
  const versionRef = useRef(0)
  const savedRef = useRef(0)
  const busyRef = useRef(false)
  const saveTimer = useRef<number | undefined>(undefined)

  const apply = useCallback((next: SittingStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const fail = useCallback((failure: unknown) => {
    if (failure instanceof SittingError && failure.code === 'offline') setOnline(false)
    else setMessage(failure instanceof Error ? failure.message : 'Something went wrong.')
  }, [])

  const loadExam = useCallback(async () => {
    const start = await sitting.load()
    setOnline(true)
    apply(start)
    if (!start.exam) return
    // Answers typed just before a crash may be newer here than on the teacher's machine.
    const draft = start.status === 'working' && sitting.draftKey ? loadDraft(sitting.draftKey) : null
    answersRef.current = draft ?? start.answers
    if (draft) versionRef.current++
    setAnswers(answersRef.current)
    setUnsaved(draft !== null)
    examRef.current = start.exam
    setExam(start.exam)
  }, [sitting, apply])

  /** Sends the answers to the teacher's machine if they changed since the last time. */
  const flush = useCallback(async () => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    const version = versionRef.current
    if (version === savedRef.current || statusRef.current?.status !== 'working' || statusRef.current.state !== 'running') return
    try {
      apply(await sitting.save(answersRef.current))
      savedRef.current = version
      setOnline(true)
      setUnsaved(versionRef.current !== version)
    } catch (failure) {
      // A refusal (time over, already submitted) is settled by the next status check.
      if (failure instanceof SittingError && failure.code === 'offline') setOnline(false)
    }
  }, [sitting, apply])

  // The laboratory the student had before the exam comes back when the exam is left.
  useEffect(() => {
    const before = labStore.get()
    return () => actions.restore(before)
  }, [])

  /**
   * When the time runs out, what has been written is handed in as it stands.
   * Tried again on every status check until the teacher's machine has it.
   */
  const handIn = useCallback(async () => {
    const status = statusRef.current
    if (!examRef.current || !status || status.status !== 'working' || status.deadline === null || Date.now() < status.deadline) return
    const version = versionRef.current
    try {
      apply(await sitting.submit(answersRef.current))
      savedRef.current = version
      setUnsaved(false)
      setOnline(true)
    } catch (failure) {
      // Out of reach or too late: the teacher's machine keeps the answers it last received.
      if (failure instanceof SittingError && failure.code === 'offline') setOnline(false)
    }
  }, [sitting, apply])

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        if (!examRef.current) await loadExam()
        else {
          apply(await sitting.poll())
          setOnline(true)
          await flush()
          await handIn()
        }
      } catch (failure) {
        if (!cancelled) fail(failure)
      } finally {
        busyRef.current = false
      }
    }
    void check()
    const timer = window.setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(saveTimer.current)
    }
  }, [sitting, loadExam, flush, handIn, apply, fail])

  const deadline = status?.deadline ?? null
  const remaining = deadline === null ? null : deadline - now
  const timeOver = status?.state === 'ended' || (remaining !== null && remaining <= 0)
  const editable = exam !== null && status?.state === 'running' && status.status === 'working' && !timeOver

  const updateAnswer = useCallback(
    (questionId: string, answer: Answer) => {
      answersRef.current = { ...answersRef.current, [questionId]: answer }
      setAnswers(answersRef.current)
      versionRef.current++
      setUnsaved(true)
      if (sitting.draftKey) saveDraft(sitting.draftKey, answersRef.current)
      saveTimer.current ??= window.setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [sitting, flush],
  )

  useEffect(() => {
    if (timeOver) void handIn()
  }, [timeOver, handIn])

  const question = exam?.questions[Math.min(current, (exam?.questions.length ?? 1) - 1)] ?? null
  const benchQuestion = editable && question?.type === 'bench' ? question : null

  // A bench question brings its apparatus; the student's changes to it are part of the answer.
  useEffect(() => {
    if (!benchQuestion) return
    const stored = answersRef.current[benchQuestion.id]
    const lab = stored?.type === 'bench' ? stored.lab : null
    actions.loadSnapshot(lab ?? benchQuestion.setup, { lock: { notebook: benchQuestion.allowNotebook }, concealUnknowns: benchQuestion.concealUnknowns })
    let last = JSON.stringify(actions.exportSnapshot())
    let timer: number | undefined
    const capture = () => {
      timer = undefined
      const snapshot = actions.exportSnapshot()
      const text = JSON.stringify(snapshot)
      if (text === last) return
      last = text
      const answer = answersRef.current[benchQuestion.id]
      updateAnswer(benchQuestion.id, { ...(answer?.type === 'bench' ? answer : emptyAnswer(benchQuestion)), lab: snapshot } as Answer)
    }
    const unsubscribe = labStore.subscribe(() => {
      timer ??= window.setTimeout(capture, BENCH_CAPTURE_DELAY_MS)
    })
    return () => {
      unsubscribe()
      if (timer !== undefined) {
        window.clearTimeout(timer)
        capture()
      }
    }
  }, [benchQuestion, updateAnswer])

  const unanswered = useMemo(() => (exam ? exam.questions.filter((entry) => !isAnswered(entry, answers[entry.id])) : []), [exam, answers])

  const run = async (action: () => Promise<SittingStatus>) => {
    setWorking(true)
    setMessage('')
    try {
      apply(await action())
      setOnline(true)
    } catch (failure) {
      if (failure instanceof SittingError && failure.code === 'offline') setMessage('The teacher’s computer cannot be reached. Your answers are kept on this computer; try again in a moment.')
      else fail(failure)
    } finally {
      setWorking(false)
    }
  }

  const submit = () =>
    run(async () => {
      const next = await sitting.submit(answersRef.current)
      savedRef.current = versionRef.current
      setUnsaved(false)
      setConfirming(false)
      return next
    })

  const savePdf = async () => {
    if (!exam || !status) return
    const html = answerSheetHtml(
      masterFromPaper(exam),
      { ...sitting.student, submittedAt: status.submittedAt, autoCollected: status.autoCollected, answers: answersRef.current, marks: {} },
      { graded: false, roomName: sitting.roomName },
    )
    await desktop().savePdf({ defaultName: `${fileSafe(`${exam.title} - ${sitting.student.name}`)}.pdf`, html })
  }

  const saveAnswersFile = async () => {
    const file = sitting.answersFile?.()
    if (!file) return
    await desktop().saveFile({
      defaultName: `${fileSafe(`${file.examTitle} - ${file.name}`)}.${FILE_EXTENSIONS.answers}`,
      text: JSON.stringify(file),
      extensions: [FILE_EXTENSIONS.answers],
      label: 'Exam answers',
    })
  }

  const leave = () => {
    if (unsaved && !window.confirm('Some of your answers have not reached the teacher’s computer. Leave anyway?')) return
    onLeave()
  }

  const bar = (
    <header className="exam-bar">
      <BrandMark />
      <h1>{exam?.title ?? sitting.examTitle}</h1>
      <span className="panel-sub">
        {sitting.student.name} · {sitting.student.className}
      </span>
      <span className="exam-bar-space" />
      {sitting.kind === 'classroom' && !online && (
        <span className="exam-pill offline" role="status">
          No connection to the teacher — keep working, your answers are kept here
        </span>
      )}
      {editable && (
        <span className={`exam-pill${unsaved ? ' pending' : ''}`} role="status">
          {unsaved ? 'Saving…' : 'All answers saved'}
        </span>
      )}
      {remaining !== null && status?.state === 'running' && (
        <span className={`exam-clock${remaining <= WARNING_MS ? ' low' : ''}`} role="timer" aria-label="Time remaining">
          {formatClock(remaining)}
        </span>
      )}
      {editable && (
        <button className="chip primary" onClick={() => setConfirming(true)}>
          Submit answers
        </button>
      )}
    </header>
  )

  const notice = message && (
    <p className="notice error" role="alert">
      {message}
    </p>
  )

  if (!status || (status.state !== 'lobby' && !exam)) {
    return (
      <div className="app exam-page">
        {bar}
        <main className="exam-scroll">
          <div className="exam-column narrow">
            <section className="panel exam-card centered">
              <h2 className="exam-title">{online ? 'Opening the exam…' : 'The teacher’s computer cannot be reached'}</h2>
              {!online && <p>Still trying. Check that this computer is connected to the lab Wi-Fi.</p>}
              {notice}
              <button className="chip" onClick={leave}>
                Leave
              </button>
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (status.state === 'lobby') {
    return (
      <div className="app exam-page">
        {bar}
        <main className="exam-scroll">
          <div className="exam-column narrow">
            <section className="panel exam-card centered">
              <h2 className="exam-title">You are in the classroom</h2>
              <p>
                {sitting.roomName} — {sitting.examTitle}
              </p>
              <p className="hint">The exam opens on this screen when your teacher starts it. There is nothing to do until then.</p>
              {notice}
              <button className="chip" onClick={leave}>
                Leave the classroom
              </button>
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (timeOver || status.status === 'submitted') {
    const delivered = status.status === 'submitted'
    return (
      <div className="app exam-page">
        {bar}
        <main className="exam-scroll">
          <div className="exam-column narrow">
            <section className="panel exam-card centered">
              <h2 className="exam-title">{timeOver ? 'The exam time is over' : 'Your answers are submitted'}</h2>
              {delivered ? (
                <p>
                  {status.autoCollected ? 'The answers you had written were collected when the time ran out.' : `Submitted at ${formatTime(status.submittedAt)}.`}
                  {sitting.kind === 'classroom' ? ' Your teacher has them.' : ''}
                </p>
              ) : (
                <p>Handing in your answers…</p>
              )}
              {exam && (
                <p className="hint">
                  {plural(exam.questions.length - unanswered.length, 'question')} answered out of {exam.questions.length}.
                </p>
              )}
              {!timeOver && <p className="hint">You can take the submission back and change your answers until the time runs out ({remaining === null ? '' : formatClock(remaining)} left).</p>}
              {sitting.kind === 'file' && timeOver && <p className="hint">Save the answers file and give it to your teacher.</p>}
              {notice}
              <div className="exam-actions">
                {!timeOver && (
                  <button className="chip" disabled={working} onClick={() => run(() => sitting.unsubmit())}>
                    Withdraw submission and edit
                  </button>
                )}
                {sitting.answersFile && delivered && (
                  <button className="chip primary" onClick={saveAnswersFile}>
                    Save answers file
                  </button>
                )}
                <button className="chip" onClick={savePdf}>
                  Save a copy as PDF
                </button>
                {timeOver && (
                  <button className="chip" onClick={leave}>
                    Close the exam
                  </button>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    )
  }

  if (!exam || !question) return null
  const index = exam.questions.indexOf(question)
  const answer = answers[question.id]
  const change = (next: Answer) => updateAnswer(question.id, next)

  return (
    <div className="app exam-page">
      {bar}
      <nav className="question-nav" aria-label="Questions">
        {exam.questions.map((entry, position) => (
          <button
            key={entry.id}
            className={`question-tab${position === index ? ' active' : ''}${isAnswered(entry, answers[entry.id]) ? ' answered' : ''}`}
            title={`${QUESTION_TYPE_NAMES[entry.type]}${isAnswered(entry, answers[entry.id]) ? ' — answered' : ''}`}
            onClick={() => setCurrent(position)}
          >
            {position + 1}
          </button>
        ))}
        <span className="panel-sub">
          {exam.questions.length - unanswered.length} of {exam.questions.length} answered
        </span>
        <span className="exam-bar-space" />
        <button className="chip" disabled={index === 0} onClick={() => setCurrent(index - 1)}>
          ← Previous
        </button>
        <button className="chip" disabled={index === exam.questions.length - 1} onClick={() => setCurrent(index + 1)}>
          Next →
        </button>
      </nav>
      {notice}

      {question.type === 'bench' ? (
        <>
          <section className="panel bench-question" aria-label={`Question ${index + 1}`}>
            <div className="bench-question-text">
              <h2>
                Question {index + 1} · {plural(question.points, 'point')}
                <button className="chip" title="Put the apparatus back as it was given" onClick={() => actions.loadSnapshot(question.setup, { lock: { notebook: question.allowNotebook }, concealUnknowns: question.concealUnknowns })}>
                  Reset the bench
                </button>
              </h2>
              <p className="exam-prompt">{question.prompt}</p>
            </div>
            <AnswerInput question={question} answer={answer} onChange={change} />
          </section>
          <LabWorkspace />
        </>
      ) : (
        <main className="exam-scroll">
          <div className="exam-column">
            <section className="panel exam-card" aria-label={`Question ${index + 1}`}>
              <header className="panel-header">
                <h2>
                  Question {index + 1} · {QUESTION_TYPE_NAMES[question.type]}
                </h2>
                <span className="panel-sub">{plural(question.points, 'point')}</span>
              </header>
              <div className="exam-form">
                <p className="exam-prompt">{question.prompt}</p>
                <AnswerInput question={question} answer={answer} onChange={change} />
              </div>
            </section>
            {exam.instructions.trim() && index === 0 && <p className="hint exam-prompt">{exam.instructions}</p>}
          </div>
        </main>
      )}

      {confirming && (
        <div className="exam-overlay" role="dialog" aria-modal="true" aria-label="Submit answers">
          <section className="panel exam-card centered">
            <h2 className="exam-title">Submit your answers?</h2>
            {unanswered.length > 0 ? (
              <p className="notice warning">
                {plural(unanswered.length, 'question')} not answered yet: {unanswered.map((entry) => exam.questions.indexOf(entry) + 1).join(', ')}.
              </p>
            ) : (
              <p>All {exam.questions.length} questions are answered.</p>
            )}
            <p className="hint">You can take the submission back and change your answers as long as the time has not run out.</p>
            {notice}
            <div className="exam-actions">
              <button className="chip" onClick={() => setConfirming(false)}>
                Keep working
              </button>
              <button className="chip primary" disabled={working} onClick={submit}>
                Submit
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
