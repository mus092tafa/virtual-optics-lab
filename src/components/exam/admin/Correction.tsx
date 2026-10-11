import { useState } from 'react'
import { answerSheetHtml } from '../../../exam/documents'
import { fileSafe, isAnswered } from '../../../exam/format'
import { answerDigest, autoMark, clampPoints, fieldCorrect, parseNumber, questionScore, studentTotal } from '../../../exam/grading'
import type { Answer, LabSnapshot, Mark, Question, SessionRecord, StudentRecord } from '../../../exam/types'
import { desktop } from '../../../platform/desktop'
import { QUESTION_TYPE_NAMES, formatDateTime, plural } from '../shared'
import { LabOverlay } from './LabOverlay'

interface Props {
  session: SessionRecord
  student: StudentRecord
  onBack(): void
  onSelect(studentId: string): void
}

/** One student's answers next to the answer key, with the marks the teacher gives. */
export function Correction({ session, student, onBack, onSelect }: Props) {
  const [bench, setBench] = useState<{ title: string; lab: LabSnapshot } | null>(null)
  const exam = session.exam
  const total = studentTotal(exam, student)
  const submitted = student.status === 'submitted'
  const others = session.students.filter((entry) => entry.status === 'submitted')
  const position = others.findIndex((entry) => entry.id === student.id)

  const setMark = (questionId: string, mark: Mark | null) => desktop().setMark({ sessionId: session.id, studentId: student.id, questionId, mark })

  const exportPdf = () =>
    desktop().savePdf({
      defaultName: `${fileSafe(`${exam.title} - ${student.name}`)}.pdf`,
      html: answerSheetHtml(exam, student, { graded: true, roomName: session.roomName }),
    })

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <button className="chip" onClick={onBack}>
            ← {session.roomName}
          </button>
          <span className="exam-bar-space" />
          {position >= 0 && (
            <span className="panel-sub">
              {position + 1} of {others.length} submitted
            </span>
          )}
          <button className="chip" disabled={position <= 0} onClick={() => onSelect(others[position - 1].id)}>
            ← Previous student
          </button>
          <button className="chip" disabled={position < 0 || position >= others.length - 1} onClick={() => onSelect(others[position + 1].id)}>
            Next student →
          </button>
          <button className="chip" onClick={exportPdf}>
            Save marked sheet (PDF)
          </button>
        </div>

        <section className="panel exam-card">
          <div className="student-summary">
            <div>
              <h2 className="exam-title">{student.name}</h2>
              <p className="panel-sub">
                {student.className} · {submitted ? `${student.autoCollected ? 'collected at the time limit' : 'submitted'} ${formatDateTime(student.submittedAt)}` : 'still working — the answers below may change'}
              </p>
            </div>
            <div className="score-box">
              <strong>
                {total.score} / {total.max}
              </strong>
              <span className={total.pending > 0 ? 'concealed' : 'panel-sub'}>{total.pending > 0 ? `${plural(total.pending, 'question')} to mark` : 'fully marked'}</span>
            </div>
          </div>
        </section>

        {exam.questions.map((question, index) => (
          <QuestionMarking
            // The editor keeps what is being typed, so it is tied to one student's one question.
            key={`${student.id}:${question.id}`}
            index={index}
            question={question}
            answer={student.answers[question.id]}
            mark={student.marks[question.id]}
            disabled={!submitted}
            onSave={(mark) => setMark(question.id, mark)}
            onViewBench={(lab) => setBench({ title: `Question ${index + 1} — bench as ${student.name} left it`, lab })}
          />
        ))}
      </div>

      {bench && (
        <LabOverlay title={bench.title} snapshot={bench.lab}>
          <span className="panel-sub">All values are shown. Anything you change here is not saved.</span>
          <button className="chip primary" onClick={() => setBench(null)}>
            Close
          </button>
        </LabOverlay>
      )}
    </main>
  )
}

interface MarkingProps {
  index: number
  question: Question
  answer: Answer | undefined
  mark: Mark | undefined
  disabled: boolean
  onSave(mark: Mark | null): void
  onViewBench(lab: LabSnapshot): void
}

function QuestionMarking({ index, question, answer, mark, disabled, onSave, onViewBench }: MarkingProps) {
  const [points, setPoints] = useState(mark ? String(mark.points) : '')
  const [comment, setComment] = useState(mark?.comment ?? '')
  const [hint, setHint] = useState('')
  const auto = autoMark(question, answer)
  const score = questionScore(question, answer, mark)

  const commit = (pointsText: string, commentText: string) => {
    setHint('')
    if (pointsText.trim() === '') {
      // Without points of the teacher's own, a complete automatic mark stands.
      if (commentText.trim() === '') return mark && onSave(null)
      if (!auto?.complete) return setHint('Enter the points to save this comment.')
      return onSave({ points: auto.points, comment: commentText, answerDigest: answerDigest(answer) })
    }
    const value = parseNumber(pointsText)
    if (!Number.isFinite(value)) return setHint('The points must be a number.')
    const clamped = clampPoints(value, question)
    setPoints(String(clamped))
    onSave({ points: clamped, comment: commentText, answerDigest: answerDigest(answer) })
  }

  const give = (value: number) => {
    setPoints(String(value))
    commit(String(value), comment)
  }

  const status =
    score.source === 'teacher' ? (score.stale ? 'answer changed after marking' : 'marked by you') : score.source === 'auto' ? 'marked automatically' : 'to be marked'

  return (
    <section className={`panel exam-card marking ${score.stale ? 'pending' : score.source}`} aria-label={`Question ${index + 1}`}>
      <header className="panel-header">
        <h2>
          Question {index + 1} · {QUESTION_TYPE_NAMES[question.type]}
        </h2>
        <span className={`exam-pill ${score.source === 'pending' || score.stale ? 'pending' : ''}`}>{status}</span>
        <span className="exam-bar-space" />
        <strong className="mono">
          {score.points ?? '—'} / {question.points}
        </strong>
      </header>
      <div className="exam-form">
        <p className="exam-prompt">{question.prompt}</p>

        {question.type === 'written' && (
          <>
            <div className="answer-box">{answer?.type === 'written' && answer.text.trim() ? answer.text : <span className="empty">No answer.</span>}</div>
            {question.modelAnswer.trim() && (
              <div className="key-box">
                <span className="field-label">Model answer</span>
                {question.modelAnswer}
              </div>
            )}
          </>
        )}

        {question.type === 'mcq' && (
          <div className="mcq-options">
            {question.options.map((option, position) => {
              const chosen = answer?.type === 'mcq' && answer.choice === option.id
              const correct = question.correctOptionId === option.id
              return (
                <div key={option.id} className={`mcq-option static${chosen ? ' chosen' : ''}${correct ? ' correct' : ''}${chosen && !correct ? ' wrong' : ''}`}>
                  <span className="mcq-letter">{String.fromCharCode(65 + position)}</span>
                  <span>{option.text}</span>
                  <span className="exam-bar-space" />
                  {chosen && <em>student’s choice</em>}
                  {correct && <em>correct</em>}
                </div>
              )
            })}
            {!isAnswered(question, answer) && <span className="empty">No choice made.</span>}
          </div>
        )}

        {question.type === 'bench' && (
          <>
            {question.fields.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Student’s value</th>
                    <th>Accepted</th>
                    <th>Check</th>
                  </tr>
                </thead>
                <tbody>
                  {question.fields.map((field) => {
                    const typed = answer?.type === 'bench' ? (answer.values[field.id] ?? '') : ''
                    const correct = fieldCorrect(field, typed)
                    return (
                      <tr key={field.id}>
                        <td>{field.label}</td>
                        <td>{typed.trim() ? `${typed} ${field.unit}` : <span className="empty">blank</span>}</td>
                        <td>{field.expected === null ? '—' : `${field.expected} ± ${field.tolerance} ${field.unit}`}</td>
                        <td className={correct === null ? '' : correct ? 'verdict-right' : 'verdict-wrong'}>{correct === null ? 'mark by hand' : correct ? 'within tolerance' : 'outside tolerance'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {answer?.type === 'bench' && answer.notes.trim() && <div className="answer-box">{answer.notes}</div>}
            <div className="control-row end">
              {auto && !auto.complete && <span className="panel-sub">Automatic part: {auto.points} points for the checked values.</span>}
              <button className="chip" disabled={answer?.type !== 'bench' || !answer.lab} onClick={() => answer?.type === 'bench' && answer.lab && onViewBench(answer.lab)}>
                {answer?.type === 'bench' && answer.lab ? 'View the student’s bench' : 'The bench was left as given'}
              </button>
            </div>
          </>
        )}

        <div className="mark-row">
          <label className="inline-field">
            Points
            <input
              className="exam-input mono short"
              inputMode="decimal"
              placeholder={auto ? `auto ${auto.points}` : ''}
              value={points}
              disabled={disabled}
              onChange={(event) => setPoints(event.target.value)}
              onBlur={() => commit(points, comment)}
            />
            <span className="panel-sub">of {question.points}</span>
          </label>
          <button className="chip" disabled={disabled} onClick={() => give(question.points)}>
            Full
          </button>
          <button className="chip" disabled={disabled} onClick={() => give(0)}>
            Zero
          </button>
          {score.stale && (
            <button className="chip" disabled={disabled} onClick={() => commit(points, comment)}>
              Keep this mark
            </button>
          )}
          <input
            className="exam-input comment"
            placeholder="Comment for the student (optional)"
            aria-label="Comment"
            value={comment}
            disabled={disabled}
            onChange={(event) => setComment(event.target.value)}
            onBlur={() => commit(points, comment)}
          />
        </div>
        {hint && <p className="concealed">{hint}</p>}
        {disabled && <p className="hint">Marks can be given once the student has submitted.</p>}
      </div>
    </section>
  )
}
