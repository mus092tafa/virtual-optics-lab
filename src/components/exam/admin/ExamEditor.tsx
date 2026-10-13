import { useEffect, useMemo, useRef, useState } from 'react'
import { experiment } from '../../../education/experiments'
import { QUESTION_CSV_TEMPLATE, importQuestions } from '../../../exam/csv'
import { DURATION_LIMITS, examProblems, newBenchField, newOption, newQuestion } from '../../../exam/format'
import { maxPoints } from '../../../exam/grading'
import type { BenchQuestion, ExamMaster, McqQuestion, Question, QuestionType } from '../../../exam/types'
import { desktop } from '../../../platform/desktop'
import { actions } from '../../../state/labState'
import type { ExperimentId } from '../../../state/presets'
import { QUESTION_TYPE_NAMES, plural } from '../shared'
import { LabOverlay } from './LabOverlay'

interface Props {
  exam: ExamMaster
  onClose(): void
}

const SAVE_DELAY_MS = 400
const SECTION_NAMES: Record<string, string> = { bench: 'Optical bench', surface: 'Reflection & refraction', interferometer: 'Interferometer', eye: 'Human eye' }

/** What the bench of a question holds, in a few words. */
function describeSetup(setup: BenchQuestion['setup']): string {
  if (typeof setup.section !== 'string') return 'No bench set up yet'
  const parts = [SECTION_NAMES[setup.section] ?? setup.section]
  try {
    parts.push(experiment(setup.experiment as ExperimentId).title)
  } catch {
    // An experiment this version does not know; the section alone is shown.
  }
  if (setup.section === 'bench' && Array.isArray(setup.components)) parts.push(plural(setup.components.length, 'component'))
  return parts.join(' · ')
}

/** The bench as it goes into a question: without the teacher's own measurements. */
const captureSetup = (): BenchQuestion['setup'] => ({ ...actions.exportSnapshot(), notebook: {}, mode: 'experiment', revealed: false })

const stamped = (exam: ExamMaster): ExamMaster => ({ ...exam, updatedAt: Date.now() })

const numberOrNull = (text: string): number | null => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text))

/** Writing an exam: its settings and its questions. Changes are saved as they are made. */
export function ExamEditor({ exam: initial, onClose }: Props) {
  const [exam, setExam] = useState(initial)
  const [saved, setSaved] = useState(true)
  const [benchFor, setBenchFor] = useState<string | null>(null)
  const [importNotes, setImportNotes] = useState<string[]>([])
  const latest = useRef(exam)
  const timer = useRef<number | undefined>(undefined)
  const problems = useMemo(() => examProblems(exam), [exam])

  const update = (change: (current: ExamMaster) => ExamMaster) => {
    latest.current = stamped(change(latest.current))
    setExam(latest.current)
    setSaved(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      timer.current = undefined
      await desktop().saveExam(latest.current)
      setSaved(true)
    }, SAVE_DELAY_MS)
  }

  // Leaving the editor writes whatever has not been saved yet.
  useEffect(
    () => () => {
      if (timer.current === undefined) return
      window.clearTimeout(timer.current)
      void desktop().saveExam(latest.current)
    },
    [],
  )

  const patchQuestion = (id: string, patch: Partial<Question>) =>
    update((current) => ({ ...current, questions: current.questions.map((question) => (question.id === id ? ({ ...question, ...patch } as Question) : question)) }))

  const move = (index: number, by: number) =>
    update((current) => {
      const questions = [...current.questions]
      const [moved] = questions.splice(index, 1)
      questions.splice(index + by, 0, moved)
      return { ...current, questions }
    })

  const add = (type: QuestionType) => update((current) => ({ ...current, questions: [...current.questions, newQuestion(type)] }))

  const importCsv = async () => {
    const file = await desktop().openFile({ title: 'Import questions from a spreadsheet (CSV)', extensions: ['csv', 'txt'], label: 'CSV file' })
    if (!file) return
    const result = importQuestions(file.text)
    if (result.questions.length > 0) update((current) => ({ ...current, questions: [...current.questions, ...result.questions] }))
    setImportNotes([`${plural(result.questions.length, 'question')} imported from ${file.name}.`, ...result.errors])
  }

  const saveTemplate = () => desktop().saveFile({ defaultName: 'exam-questions-template.csv', text: QUESTION_CSV_TEMPLATE, extensions: ['csv'], label: 'CSV file' })

  const benchQuestion = exam.questions.find((question): question is BenchQuestion => question.id === benchFor && question.type === 'bench')

  return (
    <main className="exam-scroll">
      <div className="exam-column wide">
        <div className="exam-toolbar">
          <button className="chip" onClick={onClose}>
            ← All exams
          </button>
          <span className="panel-sub" role="status">
            {saved ? 'All changes saved' : 'Saving…'}
          </span>
          <span className="exam-bar-space" />
          <span className="panel-sub">
            {plural(exam.questions.length, 'question')} · {plural(maxPoints(exam), 'point')}
          </span>
        </div>

        <section className="panel exam-card">
          <header className="panel-header">
            <h2>Exam</h2>
          </header>
          <div className="exam-form grid">
            <label className="span-2">
              <span>Title</span>
              <input className="exam-input" value={exam.title} onChange={(event) => update((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Course or subject</span>
              <input className="exam-input" value={exam.course} onChange={(event) => update((current) => ({ ...current, course: event.target.value }))} />
            </label>
            <label>
              <span>Exam time (minutes)</span>
              <input
                className="exam-input mono"
                type="number"
                min={DURATION_LIMITS.min}
                max={DURATION_LIMITS.max}
                value={exam.durationMinutes || ''}
                onChange={(event) => update((current) => ({ ...current, durationMinutes: Number(event.target.value) }))}
              />
            </label>
            <label className="span-2">
              <span>Instructions shown to the students</span>
              <textarea className="exam-input" rows={2} value={exam.instructions} onChange={(event) => update((current) => ({ ...current, instructions: event.target.value }))} />
            </label>
          </div>
        </section>

        {problems.length > 0 && (
          <div className="notice warning">
            <strong>Not ready to be given yet:</strong>
            <ul>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        {exam.questions.map((question, index) => (
          <section key={question.id} className="panel exam-card" aria-label={`Question ${index + 1}`}>
            <header className="panel-header">
              <h2>
                Question {index + 1} · {QUESTION_TYPE_NAMES[question.type]}
              </h2>
              <span className="exam-bar-space" />
              <label className="inline-field">
                Points
                <input className="exam-input mono short" type="number" min={0} step="any" value={question.points || ''} onChange={(event) => patchQuestion(question.id, { points: Number(event.target.value) })} />
              </label>
              <button className="chip" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
                ↑
              </button>
              <button className="chip" disabled={index === exam.questions.length - 1} onClick={() => move(index, 1)} aria-label="Move down">
                ↓
              </button>
              <button
                className="chip danger"
                onClick={() => {
                  if (window.confirm(`Delete question ${index + 1}?`)) update((current) => ({ ...current, questions: current.questions.filter((entry) => entry.id !== question.id) }))
                }}
              >
                Delete
              </button>
            </header>
            <div className="exam-form">
              <label>
                <span>Question</span>
                <textarea className="exam-input" rows={3} value={question.prompt} onChange={(event) => patchQuestion(question.id, { prompt: event.target.value })} />
              </label>

              {question.type === 'written' && (
                <label>
                  <span>Model answer (only you see it, while marking)</span>
                  <textarea className="exam-input" rows={2} value={question.modelAnswer} onChange={(event) => patchQuestion(question.id, { modelAnswer: event.target.value })} />
                </label>
              )}

              {question.type === 'mcq' && <McqEditor question={question} onChange={(patch) => patchQuestion(question.id, patch)} />}

              {question.type === 'bench' && <BenchEditor question={question} onChange={(patch) => patchQuestion(question.id, patch)} onSetUp={() => setBenchFor(question.id)} />}
            </div>
          </section>
        ))}

        <div className="exam-toolbar">
          <span className="panel-sub">Add a question:</span>
          <button className="chip primary" onClick={() => add('written')}>
            + Written
          </button>
          <button className="chip primary" onClick={() => add('mcq')}>
            + Multiple choice
          </button>
          <button className="chip primary" onClick={() => add('bench')}>
            + Laboratory bench
          </button>
          <span className="exam-bar-space" />
          <button className="chip" onClick={importCsv} title="Written and multiple-choice questions typed in Excel and saved as CSV">
            Import from CSV…
          </button>
          <button className="chip" onClick={saveTemplate}>
            CSV template
          </button>
        </div>
        {importNotes.length > 0 && (
          <div className="notice info">
            {importNotes.map((note) => (
              <div key={note}>{note}</div>
            ))}
          </div>
        )}
      </div>

      {benchQuestion && (
        <LabOverlay title={`Bench for question ${exam.questions.indexOf(benchQuestion) + 1}`} snapshot={typeof benchQuestion.setup.section === 'string' ? benchQuestion.setup : null} withHeader>
          <span className="panel-sub">Arrange the apparatus as the student should find it. All values are visible to you here.</span>
          <button className="chip" onClick={() => setBenchFor(null)}>
            Cancel
          </button>
          <button
            className="chip primary"
            onClick={() => {
              patchQuestion(benchQuestion.id, { setup: captureSetup() })
              setBenchFor(null)
            }}
          >
            Use this set-up
          </button>
        </LabOverlay>
      )}
    </main>
  )
}

function McqEditor({ question, onChange }: { question: McqQuestion; onChange(patch: Partial<McqQuestion>): void }) {
  return (
    <div className="option-editor">
      <span className="field-label">Choices — select the correct one</span>
      {question.options.map((option, index) => (
        <div key={option.id} className="option-row">
          <input
            type="radio"
            name={`correct-${question.id}`}
            aria-label={`Choice ${String.fromCharCode(65 + index)} is correct`}
            checked={question.correctOptionId === option.id}
            onChange={() => onChange({ correctOptionId: option.id })}
          />
          <span className="mcq-letter">{String.fromCharCode(65 + index)}</span>
          <input
            className="exam-input"
            value={option.text}
            aria-label={`Choice ${String.fromCharCode(65 + index)}`}
            onChange={(event) => onChange({ options: question.options.map((entry) => (entry.id === option.id ? { ...entry, text: event.target.value } : entry)) })}
          />
          <button
            className="icon-button"
            aria-label={`Remove choice ${String.fromCharCode(65 + index)}`}
            disabled={question.options.length <= 2}
            onClick={() =>
              onChange({
                options: question.options.filter((entry) => entry.id !== option.id),
                correctOptionId: question.correctOptionId === option.id ? null : question.correctOptionId,
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      {question.options.length < 8 && (
        <button className="chip" onClick={() => onChange({ options: [...question.options, newOption()] })}>
          + Choice
        </button>
      )}
    </div>
  )
}

function BenchEditor({ question, onChange, onSetUp }: { question: BenchQuestion; onChange(patch: Partial<BenchQuestion>): void; onSetUp(): void }) {
  const patchField = (id: string, patch: Partial<BenchQuestion['fields'][number]>) => onChange({ fields: question.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)) })
  const ready = typeof question.setup.section === 'string'
  return (
    <>
      <div className="setup-row">
        <div>
          <span className="field-label">Apparatus the student starts with</span>
          <strong className={ready ? '' : 'concealed'}>{describeSetup(question.setup)}</strong>
        </div>
        <button className={`chip${ready ? '' : ' primary'}`} onClick={onSetUp}>
          {ready ? 'Change the bench…' : 'Set up the bench…'}
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={question.concealUnknowns} onChange={(event) => onChange({ concealUnknowns: event.target.checked })} />
        Hide the unknowns from the student: lens focal lengths, the interferometer’s laser line, and the eye’s length, cornea and age
      </label>
      <label className="check">
        <input type="checkbox" checked={question.allowNotebook} onChange={(event) => onChange({ allowNotebook: event.target.checked })} />
        Allow the lab notebook (it evaluates the experiment’s formula from the student’s readings)
      </label>

      <div className="option-editor">
        <span className="field-label">Values the student reports. With an accepted value the answer is checked automatically; without one you mark it by hand.</span>
        <div className="field-grid head">
          <span>Quantity</span>
          <span>Unit</span>
          <span>Accepted value</span>
          <span>± Tolerance</span>
          <span />
        </div>
        {question.fields.map((field) => (
          <div key={field.id} className="field-grid">
            <input className="exam-input" placeholder="e.g. Focal length f" aria-label="Quantity" value={field.label} onChange={(event) => patchField(field.id, { label: event.target.value })} />
            <input className="exam-input" placeholder="cm" aria-label="Unit" value={field.unit} onChange={(event) => patchField(field.id, { unit: event.target.value })} />
            <input
              className="exam-input mono"
              type="number"
              step="any"
              aria-label="Accepted value"
              value={field.expected ?? ''}
              onChange={(event) => patchField(field.id, { expected: numberOrNull(event.target.value) })}
            />
            <input
              className="exam-input mono"
              type="number"
              step="any"
              min={0}
              aria-label="Tolerance"
              disabled={field.expected === null}
              value={field.expected === null ? '' : field.tolerance}
              onChange={(event) => patchField(field.id, { tolerance: Math.abs(numberOrNull(event.target.value) ?? 0) })}
            />
            <button className="icon-button" aria-label="Remove this value" onClick={() => onChange({ fields: question.fields.filter((entry) => entry.id !== field.id) })}>
              ×
            </button>
          </div>
        ))}
        <button className="chip" onClick={() => onChange({ fields: [...question.fields, newBenchField()] })}>
          + Value
        </button>
        <p className="hint">The accepted values are yours to state: open the bench to read what the laboratory calculates for your set-up. Students may also be asked only for working and remarks, with no values.</p>
      </div>
    </>
  )
}
