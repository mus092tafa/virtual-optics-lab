import { afterEach, describe, expect, it } from 'vitest'
import classroomModule from '../classroom.cjs'

const { Classroom, GRACE_MS, discoverClassrooms, hostClassroom, scanClassrooms } = classroomModule

const MINUTE = 60_000

function newSession() {
  const exam = { id: 'exam-1', title: 'Optics midterm', durationMinutes: 30, questions: [{ id: 'q1', type: 'mcq', correctOptionId: 'b' }] }
  return {
    id: 'session-1',
    roomName: 'Group A',
    exam,
    paper: { id: 'exam-1', title: 'Optics midterm', durationMinutes: 30, questions: [{ id: 'q1', type: 'mcq' }] },
    createdAt: 0,
    startedAt: null,
    deadline: null,
    endedAt: null,
    state: 'lobby',
    students: [],
  }
}

function setup() {
  const clock = { time: 1_000_000 }
  let changes = 0
  const session = newSession()
  const classroom = new Classroom(session, { now: () => clock.time, onChange: () => changes++ })
  return { clock, session, classroom, changes: () => changes }
}

const layla = { name: ' Layla   Hassan ', className: '3B', deviceId: 'device-1' }
const answer = (choice) => ({ q1: { type: 'mcq', choice } })

describe('classroom rules', () => {
  it('asks for a name and a class', () => {
    const { classroom } = setup()
    expect(() => classroom.join({ name: '', className: '3B', deviceId: 'd' })).toThrow('Enter your name and your class.')
    expect(() => classroom.join({ name: 'Layla', className: '  ', deviceId: 'd' })).toThrow('Enter your name and your class.')
    expect(() => classroom.join({ name: 'Layla', className: '3B' })).toThrow()
  })

  it('keeps the questions back until the teacher starts the exam', () => {
    const { classroom } = setup()
    const joined = classroom.join(layla)
    expect(joined.student.name).toBe('Layla Hassan')
    expect(joined.session.state).toBe('lobby')
    expect(joined.exam).toBeUndefined()
    expect(() => classroom.saveAnswers(joined.token, answer('b'))).toThrow('not open')
    classroom.begin()
    const view = classroom.view(classroom.find(joined.token), true)
    expect(view.exam.questions).toHaveLength(1)
    // The student never receives the answer key.
    expect(JSON.stringify(view)).not.toContain('correctOptionId')
  })

  it('sets one deadline for everyone from the exam time', () => {
    const { classroom, clock, session } = setup()
    classroom.join(layla)
    classroom.begin()
    expect(session.deadline).toBe(clock.time + 30 * MINUTE)
    clock.time += 10 * MINUTE
    // A late arrival does not get extra time.
    const late = classroom.join({ name: 'Omar Aziz', className: '3B', deviceId: 'device-2' })
    expect(late.session.deadline).toBe(session.deadline)
    expect(late.exam).toBeDefined()
    classroom.extend(5)
    expect(session.deadline).toBe(1_000_000 + 35 * MINUTE)
  })

  it('gives a laptop its own sitting back when it joins again', () => {
    const { classroom, session } = setup()
    const first = classroom.join(layla)
    classroom.begin()
    classroom.saveAnswers(first.token, answer('a'))
    const again = classroom.join({ ...layla, name: 'Someone Else' })
    expect(again.token).toBe(first.token)
    expect(again.student.name).toBe('Layla Hassan')
    expect(again.answers).toEqual(answer('a'))
    expect(session.students).toHaveLength(1)
    expect(session.students[0].events.map((event) => event.type)).toEqual(['joined', 'rejoined'])
  })

  it('lets a student withdraw a submission while time remains, and not after', () => {
    const { classroom, clock, session } = setup()
    const { token } = classroom.join(layla)
    classroom.begin()
    expect(classroom.submit(token, answer('a')).student.status).toBe('submitted')
    expect(() => classroom.saveAnswers(token, answer('b'))).toThrow('Withdraw the submission')
    expect(classroom.unsubmit(token).student.status).toBe('working')
    classroom.saveAnswers(token, answer('b'))
    classroom.submit(token)
    expect(session.students[0].answers).toEqual(answer('b'))
    clock.time = session.deadline
    expect(() => classroom.unsubmit(token)).toThrow('can no longer be withdrawn')
    expect(session.students[0].events.map((event) => event.type)).toEqual(['joined', 'submitted', 'unsubmitted', 'submitted'])
  })

  it('accepts the last answers during the grace period and collects everything after it', () => {
    const { classroom, clock, session } = setup()
    const first = classroom.join(layla)
    const second = classroom.join({ name: 'Omar Aziz', className: '3B', deviceId: 'device-2' })
    classroom.begin()
    classroom.saveAnswers(second.token, answer('a'))
    clock.time = session.deadline + GRACE_MS - 1
    classroom.tick()
    expect(session.state).toBe('running')
    // The laptop hands in at the deadline: it counts as collected, at the deadline.
    const handed = classroom.submit(first.token, answer('b'))
    expect(handed.student).toMatchObject({ status: 'submitted', autoCollected: true, submittedAt: session.deadline })
    clock.time = session.deadline + GRACE_MS + 1
    classroom.tick()
    expect(session.state).toBe('ended')
    expect(session.endedAt).toBe(session.deadline)
    expect(session.students[1]).toMatchObject({ status: 'submitted', autoCollected: true, submittedAt: session.deadline, answers: answer('a') })
    expect(() => classroom.saveAnswers(second.token, answer('b'))).toThrow('not open')
    expect(() => classroom.submit(second.token, answer('b'))).toThrow('not open')
    expect(() => classroom.join({ name: 'Late', className: '3B', deviceId: 'device-3' })).toThrow('This exam has ended.')
    // A laptop already in the sitting can still look at how it ended.
    expect(classroom.join(layla).session.state).toBe('ended')
  })

  it('ends for everyone when the teacher stops the exam', () => {
    const { classroom, clock, session } = setup()
    const { token } = classroom.join(layla)
    classroom.begin()
    clock.time += 5 * MINUTE
    classroom.end()
    expect(session.deadline).toBe(clock.time)
    expect(session.state).toBe('running')
    classroom.saveAnswers(token, answer('b'))
    clock.time += GRACE_MS + 1
    classroom.tick()
    expect(session.state).toBe('ended')
    expect(session.students[0]).toMatchObject({ autoCollected: true, answers: answer('b') })
  })

  it('gives the grace period again when the classroom is reopened after the deadline', () => {
    const { classroom, clock, session } = setup()
    const { token } = classroom.join(layla)
    classroom.begin()
    classroom.saveAnswers(token, answer('a'))
    // The teacher's machine was down across the deadline and comes back ten minutes late.
    clock.time = session.deadline + 10 * MINUTE
    const reopened = new Classroom(session, { now: () => clock.time })
    reopened.tick()
    expect(session.state).toBe('running')
    expect(reopened.submit(token, answer('b')).student).toMatchObject({ status: 'submitted', autoCollected: true, submittedAt: session.deadline })
    expect(() => reopened.unsubmit(token)).toThrow('can no longer be withdrawn')
    clock.time += GRACE_MS + 1
    reopened.tick()
    expect(session.state).toBe('ended')
    expect(session.students[0].answers).toEqual(answer('b'))
  })

  it('rejects unknown laptops and malformed answers', () => {
    const { classroom } = setup()
    const { token } = classroom.join(layla)
    classroom.begin()
    expect(() => classroom.find('nope')).toThrow('not registered')
    expect(() => classroom.find(undefined)).toThrow('not registered')
    expect(() => classroom.saveAnswers(token, 'text')).toThrow('malformed')
    expect(() => classroom.saveAnswers(token, [1, 2])).toThrow('malformed')
    classroom.saveAnswers(token, { q1: { type: 'mcq', choice: 'a' }, q2: 'junk', q3: null })
    expect(Object.keys(classroom.session.students[0].answers)).toEqual(['q1'])
  })
})

describe('classroom on the network', () => {
  let host
  afterEach(async () => {
    await host?.close()
    host = undefined
  })

  const call = async (port, method, path, token, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, headers: response.headers, data: await response.json() }
  }

  it('serves a whole sitting over HTTP', async () => {
    const { classroom, session } = setup()
    host = await hostClassroom(classroom, { port: 0, discoveryPort: null })
    const room = await call(host.port, 'GET', '/api/room')
    expect(room.data).toMatchObject({ app: 'virtual-optics-lab', roomName: 'Group A', state: 'lobby' })
    expect(room.headers.get('access-control-allow-origin')).toBe('*')

    const joined = await call(host.port, 'POST', '/api/join', undefined, layla)
    expect(joined.status).toBe(200)
    const token = joined.data.token
    expect((await call(host.port, 'GET', '/api/exam', token)).data.exam).toBeUndefined()
    expect((await call(host.port, 'GET', '/api/state')).status).toBe(401)
    expect((await call(host.port, 'GET', '/api/state', 'wrong')).status).toBe(401)
    expect((await call(host.port, 'PUT', '/api/answers', token, { answers: answer('a') })).status).toBe(409)

    classroom.begin()
    expect((await call(host.port, 'GET', '/api/exam', token)).data.exam.title).toBe('Optics midterm')
    expect((await call(host.port, 'PUT', '/api/answers', token, { answers: answer('a') })).status).toBe(200)
    expect((await call(host.port, 'POST', '/api/submit', token, { answers: answer('b') })).data.student.status).toBe('submitted')
    expect((await call(host.port, 'POST', '/api/unsubmit', token)).data.student.status).toBe('working')
    expect(session.students[0].answers).toEqual(answer('b'))

    // Nothing a teacher does is reachable from a student's laptop.
    expect((await call(host.port, 'POST', '/api/begin', token)).status).toBe(404)
    expect((await call(host.port, 'GET', '/api/session', token)).status).toBe(404)
    const preflight = await fetch(`http://127.0.0.1:${host.port}/api/answers`, { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization')
    const broken = await fetch(`http://127.0.0.1:${host.port}/api/join`, { method: 'POST', body: '{not json' })
    expect(broken.status).toBe(400)
  })

  it('is found by the students’ search', async () => {
    const { classroom } = setup()
    const discoveryPort = 47000 + Math.floor(Math.random() * 500)
    host = await hostClassroom(classroom, { port: 0, discoveryPort })
    expect(host.discoverable).toBe(true)
    const rooms = await discoverClassrooms({ timeoutMs: 400, discoveryPort })
    expect(rooms.some((room) => room.port === host.port && room.roomName === 'Group A' && room.examTitle === 'Optics midterm')).toBe(true)
  })

  it('tells the students which teacher opened it', async () => {
    const { classroom, session } = setup()
    session.teacherName = '  Dr.   Hassan '
    const discoveryPort = 47000 + Math.floor(Math.random() * 500)
    host = await hostClassroom(classroom, { port: 0, discoveryPort })
    const rooms = await discoverClassrooms({ timeoutMs: 400, discoveryPort })
    expect(rooms.find((room) => room.port === host.port)?.teacherName).toBe('Dr. Hassan')
  })

  it('is found by asking the neighbouring addresses when the search gets no reply', async () => {
    const { classroom, session } = setup()
    session.teacherName = 'Dr. Hassan'
    host = await hostClassroom(classroom, { port: 0, discoveryPort: null })
    expect(host.discoverable).toBe(false)
    // The machine answers at both of its addresses; its classroom is listed once.
    const rooms = await scanClassrooms({ port: host.port, timeoutMs: 400, hosts: ['127.0.0.1', '127.0.0.2'] })
    expect(rooms).toEqual([{ address: '127.0.0.1', port: host.port, teacherName: 'Dr. Hassan', roomName: 'Group A', examTitle: 'Optics midterm', state: 'lobby' }])
  })

  it('finds nothing where no classroom is open', async () => {
    expect(await scanClassrooms({ port: 1, timeoutMs: 300, hosts: ['127.0.0.1'] })).toEqual([])
  })
})
