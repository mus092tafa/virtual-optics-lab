import { emptyAnswer } from '../../exam/format'
import type { Answer, PaperQuestion } from '../../exam/types'

interface Props {
  question: PaperQuestion
  answer: Answer | undefined
  disabled?: boolean
  onChange(answer: Answer): void
}

/** The place where a student answers one question. */
export function AnswerInput({ question, answer, disabled = false, onChange }: Props) {
  const current = answer && answer.type === question.type ? answer : emptyAnswer(question)

  if (question.type === 'written' && current.type === 'written') {
    return (
      <textarea
        className="exam-input answer-text"
        placeholder="Write your answer here"
        aria-label="Your answer"
        value={current.text}
        disabled={disabled}
        onChange={(event) => onChange({ type: 'written', text: event.target.value })}
      />
    )
  }

  if (question.type === 'mcq' && current.type === 'mcq') {
    return (
      <div className="mcq-options" role="radiogroup" aria-label="Choices">
        {question.options.map((option, index) => (
          <label key={option.id} className={`mcq-option${current.choice === option.id ? ' chosen' : ''}`}>
            <input type="radio" name={question.id} checked={current.choice === option.id} disabled={disabled} onChange={() => onChange({ type: 'mcq', choice: option.id })} />
            <span className="mcq-letter">{String.fromCharCode(65 + index)}</span>
            <span>{option.text}</span>
          </label>
        ))}
        {current.choice !== null && !disabled && (
          <button className="chip clear-choice" onClick={() => onChange({ type: 'mcq', choice: null })}>
            Clear my choice
          </button>
        )}
      </div>
    )
  }

  if (question.type === 'bench' && current.type === 'bench') {
    return (
      <div className="bench-answer">
        <div className="bench-fields">
          {question.fields.map((field) => (
            <label key={field.id} className="bench-field">
              <span>{field.label}</span>
              <input
                className="exam-input mono"
                inputMode="decimal"
                value={current.values[field.id] ?? ''}
                disabled={disabled}
                onChange={(event) => onChange({ ...current, values: { ...current.values, [field.id]: event.target.value } })}
              />
              <em>{field.unit}</em>
            </label>
          ))}
        </div>
        <textarea
          className="exam-input bench-notes"
          placeholder="Working and remarks (optional)"
          aria-label="Working and remarks"
          value={current.notes}
          disabled={disabled}
          onChange={(event) => onChange({ ...current, notes: event.target.value })}
        />
      </div>
    )
  }
  return null
}
