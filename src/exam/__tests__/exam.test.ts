import { describe, expect, it } from 'vitest'
import { importQuestions, parseCsv, resultsCsv } from '../csv'
import { answerSheetHtml, examPaperHtml } from '../documents'
import { examProblems, fileSafe, isAnswered, masterFromPaper, newExam, parseAnswersFile, parseMaster, parsePaper, toPaper } from '../format'
import { answerDigest, autoMark, clampPoints, fieldCorrect, parseNumber, questionScore, studentTotal } from '../grading'
import { SittingError, classroomUrl, fileSitting, localSittingOwner } from '../sitting'
import type { Answers, BenchQuestion, ExamMaster, McqQuestion, SessionRecord, StudentRecord, WrittenQuestion } from '../types'

const written: WrittenQuestion = { id: 'q1', type: 'written', prompt: 'State the thin-lens equation.', points: 3, modelAnswer: '1/f = 1/do + 1/di' }
const mcq: McqQuestion = {
  id: 'q2',
  type: 'mcq',
  prompt: 'Which lens converges parallel light?',
  points: 2,
  options: [
    { id: 'a', text: 'Concave' },
    { id: 'b', text: 'Convex' },
  ],
  correctOptionId: 'b',
}
const bench: BenchQuestion = {
  id: 'q3',
  type: 'bench',
  prompt: 'Find the focal length.',
  points: 6,
  setup: { section: 'bench', experiment: 'convex-lens', components: [] },
  fields: [
    { id: 'f', label: 'Focal length f', unit: 'cm', expected: 15, tolerance: 0.5 },
    { id: 'm', label: 'Magnification m', unit: '', expected: -1, tolerance: 0.05 },
    { id: 'note', label: 'Image orientation', unit: '', expected: null, tolerance: 0 },
  ],
  concealUnknowns: true,
  allowNotebook: false,
}
const exam: ExamMaster = { ...newExam(), id: 'exam-1', title: 'Optics midterm', durationMinutes: 30, questions: [written, mcq, bench] }

const student = (answers: Answers, marks: StudentRecord['marks'] = {}): StudentRecord => ({
  id: 's1',
  name: 'Layla Hassan',
  className: '3B',
  joinedAt: 0,
  status: 'submitted',
  submittedAt: 1000,
  autoCollected: false,
  answers,
  marks,
  events: [],
  source: 'classroom',
})

describe('exam documents', () => {
  it('leaves every part of the answer key out of the student paper', () => {
    const paper = toPaper(exam)
    const text = JSON.stringify(paper)
    expect(text).not.toContain('modelAnswer')
    expect(text).not.toContain('correctOptionId')
    expect(text).not.toContain('expected')
    expect(text).not.toContain('tolerance')
    expect(text).not.toContain('1/f = 1/do + 1/di')
    expect(paper.questions.map((question) => question.points)).toEqual([3, 2, 6])
    expect(paper.durationMinutes).toBe(30)
  })

  it('drops an answer key smuggled into a student file', () => {
    const paper = parsePaper({ ...exam, format: 'optics-exam' })!
    expect(JSON.stringify(paper)).not.toContain('correctOptionId')
    expect(JSON.stringify(masterFromPaper(paper))).toContain('"correctOptionId":null')
  })

  it('round-trips a teacher file and rejects other documents', () => {
    expect(parseMaster(JSON.parse(JSON.stringify(exam)))).toEqual(exam)
    expect(parseMaster(toPaper(exam))).toBeNull()
    expect(parsePaper(exam)).toBeNull()
    expect(parseMaster({ format: 'optics-exam-master', version: 2, id: 'x', questions: [] })).toBeNull()
    expect(parseMaster('nonsense')).toBeNull()
    expect(parseAnswersFile({ format: 'optics-answers', version: 1, examId: 'exam-1', answers: { q1: { type: 'written', text: 'x' }, q9: { type: 'other' } } })?.answers).toEqual({
      q1: { type: 'written', text: 'x' },
    })
  })

  it('reports what keeps an exam from being given', () => {
    expect(examProblems(exam)).toEqual([])
    const broken: ExamMaster = {
      ...exam,
      title: ' ',
      durationMinutes: 0,
      questions: [
        { ...written, prompt: '' },
        { ...mcq, correctOptionId: null },
        { ...bench, setup: {}, points: 0 },
      ],
    }
    const problems = examProblems(broken)
    expect(problems).toContain('The exam has no title.')
    expect(problems.some((problem) => problem.includes('exam time'))).toBe(true)
    expect(problems).toContain('Question 1 has no text.')
    expect(problems).toContain('Question 2 has no correct choice marked.')
    expect(problems).toContain('Question 3 has no bench set-up.')
    expect(problems).toContain('Question 3 must be worth more than 0 points.')
    expect(examProblems({ ...exam, questions: [] })).toContain('The exam has no questions.')
  })

  it('counts a question as answered only when something was written', () => {
    const [w, m, b] = toPaper(exam).questions
    expect(isAnswered(w, { type: 'written', text: '  ' })).toBe(false)
    expect(isAnswered(w, { type: 'written', text: 'x' })).toBe(true)
    expect(isAnswered(m, { type: 'mcq', choice: null })).toBe(false)
    expect(isAnswered(b, { type: 'bench', values: {}, notes: '', lab: { section: 'bench' } })).toBe(false)
    expect(isAnswered(b, { type: 'bench', values: { f: '15' }, notes: '', lab: null })).toBe(true)
    expect(isAnswered(m, { type: 'written', text: 'x' })).toBe(false)
  })

  it('makes file names Windows accepts', () => {
    expect(fileSafe('Optics: midterm 1/2 "A"?')).toBe('Optics midterm 1 2 A')
    expect(fileSafe('...')).toBe('untitled')
  })

  it('never lets typed text become markup, and keeps the key out of the student paper', () => {
    const hostile: ExamMaster = { ...exam, title: '<script>alert(1)</script>', questions: [{ ...written, prompt: '<img src=x onerror=1>' }, mcq, bench] }
    const paper = examPaperHtml(toPaper(hostile), { key: true })
    expect(paper).not.toContain('<script>')
    expect(paper).not.toContain('<img')
    expect(paper).not.toContain('1/f = 1/do + 1/di')
    expect(examPaperHtml(hostile, { key: true })).toContain('1/f = 1/do + 1/di')
    expect(examPaperHtml(hostile, { key: false })).not.toContain('1/f = 1/do + 1/di')
    const sheet = answerSheetHtml(exam, student({ q1: { type: 'written', text: '<b>bold</b>' } }), { graded: false })
    expect(sheet).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(sheet).not.toContain('Model answer')
    expect(answerSheetHtml(exam, student({}), { graded: true })).toContain('Model answer')
  })
})

describe('marking', () => {
  it('reads numbers as students type them', () => {
    expect(parseNumber('15,2')).toBe(15.2)
    expect(parseNumber(' −1.5 ')).toBe(-1.5)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })

  it('accepts a bench value within the tolerance, limits included', () => {
    const field = bench.fields[0]
    expect(fieldCorrect(field, '15')).toBe(true)
    expect(fieldCorrect(field, '15,5')).toBe(true)
    expect(fieldCorrect(field, '14.5')).toBe(true)
    expect(fieldCorrect(field, '15.51')).toBe(false)
    expect(fieldCorrect(field, '14.49')).toBe(false)
    expect(fieldCorrect(field, '')).toBe(false)
    expect(fieldCorrect(field, 'about 15')).toBe(false)
    expect(fieldCorrect(bench.fields[2], 'inverted')).toBeNull()
    // 0.1 + 0.2 is not exactly 0.3 in binary; a value on the limit must still pass.
    expect(fieldCorrect({ ...field, expected: 0.1, tolerance: 0.2 }, '0.3')).toBe(true)
  })

  it('marks multiple choice from the key', () => {
    expect(autoMark(mcq, { type: 'mcq', choice: 'b' })).toEqual({ points: 2, complete: true })
    expect(autoMark(mcq, { type: 'mcq', choice: 'a' })).toEqual({ points: 0, complete: true })
    expect(autoMark(mcq, undefined)).toEqual({ points: 0, complete: true })
    expect(autoMark({ ...mcq, correctOptionId: null }, { type: 'mcq', choice: 'b' })).toBeNull()
    expect(autoMark(written, { type: 'written', text: 'anything' })).toBeNull()
  })

  it('gives each bench value an equal share and leaves unchecked values to the teacher', () => {
    // Three values share 6 points; two are checked against the key.
    const answer = { type: 'bench' as const, values: { f: '15.2', m: '-0.8', note: 'inverted' }, notes: '', lab: null }
    expect(autoMark(bench, answer)).toEqual({ points: 2, complete: false })
    expect(questionScore(bench, answer, undefined)).toEqual({ points: null, source: 'pending', stale: false })
    const checkedOnly = { ...bench, fields: bench.fields.slice(0, 2) }
    expect(autoMark(checkedOnly, { ...answer, values: { f: '15.2', m: '-1.02' } })).toEqual({ points: 6, complete: true })
    expect(autoMark({ ...bench, fields: [bench.fields[2]] }, answer)).toBeNull()
  })

  it('lets the teacher’s mark override the automatic one and notices a changed answer', () => {
    const answer = { type: 'mcq' as const, choice: 'a' }
    expect(questionScore(mcq, answer, undefined)).toEqual({ points: 0, source: 'auto', stale: false })
    const mark = { points: 1, comment: 'benefit of the doubt', answerDigest: answerDigest(answer) }
    expect(questionScore(mcq, answer, mark)).toEqual({ points: 1, source: 'teacher', stale: false })
    expect(questionScore(mcq, { type: 'mcq', choice: 'b' }, mark).stale).toBe(true)
    // Moving components on the bench alone does not make a marked answer stale.
    const benchAnswer = { type: 'bench' as const, values: { f: '15' }, notes: 'n', lab: { a: 1 } }
    expect(answerDigest(benchAnswer)).toBe(answerDigest({ ...benchAnswer, lab: { a: 2 } }))
    expect(answerDigest(benchAnswer)).not.toBe(answerDigest({ ...benchAnswer, values: { f: '16' } }))
  })

  it('totals a student and counts what is still to be marked', () => {
    const answers: Answers = {
      q1: { type: 'written', text: '1/f = 1/do + 1/di' },
      q2: { type: 'mcq', choice: 'b' },
      q3: { type: 'bench', values: { f: '15', m: '-1', note: 'inverted' }, notes: '', lab: null },
    }
    // Only the multiple-choice question is fully automatic: 2 of 11, two to mark.
    expect(studentTotal(exam, student(answers))).toEqual({ score: 2, max: 11, pending: 2 })
    const marks = {
      q1: { points: 2.5, comment: '', answerDigest: answerDigest(answers.q1) },
      q3: { points: 6, comment: '', answerDigest: answerDigest(answers.q3) },
    }
    expect(studentTotal(exam, student(answers, marks))).toEqual({ score: 10.5, max: 11, pending: 0 })
    expect(studentTotal(exam, student({}))).toEqual({ score: 0, max: 11, pending: 2 })
  })

  it('keeps a mark within the points of the question', () => {
    expect(clampPoints(5, written)).toBe(3)
    expect(clampPoints(-1, written)).toBe(0)
    expect(clampPoints(1.234, written)).toBe(1.23)
    expect(clampPoints(NaN, written)).toBe(0)
  })
})

describe('spreadsheet exchange', () => {
  it('parses quoted cells, embedded separators and line breaks', () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n1,"two\nlines",3\n\n')).toEqual([
      ['a', 'b,c', 'd "e"'],
      ['1', 'two\nlines', '3'],
    ])
  })

  it('reads semicolon-separated files as Excel writes them in many locales', () => {
    expect(parseCsv('﻿type;question;points\nwritten;"What is f; really?";2,5')).toEqual([
      ['type', 'question', 'points'],
      ['written', 'What is f; really?', '2,5'],
    ])
  })

  it('imports written and multiple-choice questions', () => {
    const { questions, errors } = importQuestions(
      ['type,question,points,answer,option1,option2,option3', 'mcq,Which converges?,2,B,Concave,Convex,Plane', 'mcq,By text?,1,convex,Concave,Convex,', 'mcq,By number?,1,3,A,B,C', 'written,Explain.,2.5,Because.,,,'].join('\n'),
    )
    expect(errors).toEqual([])
    expect(questions).toHaveLength(4)
    const first = questions[0] as McqQuestion
    expect(first.options.map((option) => option.text)).toEqual(['Concave', 'Convex', 'Plane'])
    expect(first.options.find((option) => option.id === first.correctOptionId)?.text).toBe('Convex')
    const second = questions[1] as McqQuestion
    expect(second.options).toHaveLength(2)
    expect(second.options.find((option) => option.id === second.correctOptionId)?.text).toBe('Convex')
    const third = questions[2] as McqQuestion
    expect(third.options.find((option) => option.id === third.correctOptionId)?.text).toBe('C')
    expect(questions[3]).toMatchObject({ type: 'written', points: 2.5, modelAnswer: 'Because.' })
    expect(new Set(questions.map((question) => question.id)).size).toBe(4)
  })

  it('explains the rows it cannot use', () => {
    const { questions, errors } = importQuestions(['type,question,points,answer,option1,option2', 'mcq,No such answer,1,7,A,B', 'mcq,One option,1,1,A,', 'bench,On the bench,1,,,', 'written,,1,,,', 'written,Bad points,zero,,,'].join('\n'))
    expect(questions).toEqual([])
    expect(errors).toHaveLength(5)
    expect(errors[0]).toContain('Row 2')
    expect(importQuestions('question only\nx').errors[0]).toContain('first row')
    expect(importQuestions('').errors).toEqual(['The file is empty.'])
  })

  it('writes the results of a sitting, one row per student', () => {
    const answers: Answers = { q2: { type: 'mcq', choice: 'b' } }
    const session: SessionRecord = {
      format: 'optics-session',
      version: 1,
      id: 'session-1',
      roomName: 'Group A',
      exam,
      paper: toPaper(exam),
      createdAt: 0,
      startedAt: 0,
      deadline: 1,
      endedAt: 1,
      state: 'ended',
      students: [student(answers), { ...student({}), name: '=cmd()', status: 'working', submittedAt: null }],
    }
    const rows = parseCsv(resultsCsv(session))
    expect(rows[0].slice(0, 2)).toEqual(['Name', 'Class'])
    expect(rows[0]).toContain('Q2 (/2)')
    // name, class, status, time, Q1 (unmarked), Q2, Q3 (unmarked), total, max, percent, to mark
    expect(rows[1]).toEqual(['Layla Hassan', '3B', 'submitted', '1970-01-01 00:00:01', '', '2', '', '2', '11', '18.2', '2'])
    expect(rows[2][0]).toBe("'=cmd()")
    expect(rows[2][2]).toBe('not submitted')
  })
})

describe('sitting an exam file', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
  }
  const paper = toPaper(exam)
  const identity = { name: 'Layla Hassan', className: '3B' }

  it('starts the clock once and keeps it across restarts', async () => {
    const store = memory()
    let time = 1_000_000
    const first = fileSitting(paper, identity, store, () => time)
    expect((await first.load()).deadline).toBe(1_000_000 + 30 * 60_000)
    await first.save({ q1: { type: 'written', text: 'draft' } })
    time += 10 * 60_000
    // Reopening the application gives the same sitting, not a fresh half hour.
    const again = fileSitting(paper, identity, store, () => time)
    const start = await again.load()
    expect(start.deadline).toBe(1_000_000 + 30 * 60_000)
    expect(start.answers).toEqual({ q1: { type: 'written', text: 'draft' } })
    expect(localSittingOwner(paper, store, () => time)).toEqual(identity)
  })

  it('allows a submission to be withdrawn only while time remains', async () => {
    const store = memory()
    let time = 0
    const sitting = fileSitting(paper, identity, store, () => time)
    expect((await sitting.submit({ q2: { type: 'mcq', choice: 'b' } })).status).toBe('submitted')
    await expect(sitting.save({})).rejects.toBeInstanceOf(SittingError)
    expect((await sitting.unsubmit()).status).toBe('working')
    await sitting.submit({ q2: { type: 'mcq', choice: 'a' } })
    time = 30 * 60_000 + 1
    await expect(sitting.unsubmit()).rejects.toThrow('The exam time is over.')
    expect(sitting.answersFile!()).toMatchObject({ examId: 'exam-1', name: 'Layla Hassan', autoCollected: false, answers: { q2: { type: 'mcq', choice: 'a' } } })
  })

  it('hands in what was written when the time runs out', async () => {
    const store = memory()
    let time = 0
    const sitting = fileSitting(paper, identity, store, () => time)
    await sitting.save({ q1: { type: 'written', text: 'unfinished' } })
    time = 30 * 60_000 + 1
    expect(await sitting.poll()).toMatchObject({ state: 'ended', status: 'submitted', autoCollected: true, submittedAt: 30 * 60_000 })
    await expect(sitting.save({})).rejects.toThrow('The exam time is over.')
    expect(sitting.answersFile!().answers).toEqual({ q1: { type: 'written', text: 'unfinished' } })
    // A running sitting belongs to whoever began it; once over, the next student starts afresh.
    expect(localSittingOwner(paper, store, () => time)).toBeNull()
    const next = fileSitting(paper, { name: 'Omar Aziz', className: '3B' }, store, () => time)
    expect(next.student.name).toBe('Omar Aziz')
    expect((await next.load()).answers).toEqual({})
  })

  it('continues a running sitting under the name it was started with', () => {
    const store = memory()
    fileSitting(paper, identity, store, () => 0)
    expect(fileSitting(paper, { name: 'Someone Else', className: '1A' }, store, () => 60_000).student).toEqual(identity)
  })

  it('builds the classroom address from what a student types', () => {
    expect(classroomUrl(' 192.168.0.10 ')).toBe('http://192.168.0.10:47800')
    expect(classroomUrl('192.168.0.10:5000/')).toBe('http://192.168.0.10:5000')
    expect(classroomUrl('http://192.168.0.10', 47805)).toBe('http://192.168.0.10:47805')
  })
})
