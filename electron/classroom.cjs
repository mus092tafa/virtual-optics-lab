// Classroom mode: the teacher's machine hands the exam to the students'
// laptops over the local network and takes their answers back. Runs on a
// router with no internet access; nothing here touches the optics.
const crypto = require('node:crypto')
const dgram = require('node:dgram')
const http = require('node:http')
const os = require('node:os')

const HTTP_PORT = 47800
const DISCOVERY_PORT = 47801
const DISCOVERY_QUERY = 'optics-classroom?'
/** Time after the deadline in which a student's last answers are still accepted. */
const GRACE_MS = 8000
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_STUDENTS = 200

class ClassroomError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const cleanText = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 80) : '')

function cleanAnswers(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ClassroomError(400, 'bad-request', 'The answers are malformed.')
  const answers = {}
  for (const [id, answer] of Object.entries(value)) {
    if (typeof answer === 'object' && answer !== null && typeof answer.type === 'string') answers[id] = answer
  }
  return answers
}

/**
 * One sitting of an exam: who has joined, the clock, and each student's
 * answers. Holds no network code, so that the rules can be tested directly.
 */
class Classroom {
  /**
   * @param session the session record; it is modified in place
   * @param options.now clock, replaceable in tests
   * @param options.onChange called after every change to the record
   */
  constructor(session, { now = Date.now, onChange = () => {} } = {}) {
    this.session = session
    this.now = now
    this.onChange = onChange
    // A classroom reopened after the teacher's machine was down gives the
    // laptops the grace period again, to hand in what they kept meanwhile.
    this.openedAt = now()
  }

  /** The moment after which nothing more is accepted. */
  closingTime() {
    return Math.max(this.session.deadline, this.openedAt) + GRACE_MS
  }

  roomInfo() {
    const { id, roomName, state, exam } = this.session
    return { app: 'virtual-optics-lab', id, roomName, examTitle: exam.title, durationMinutes: exam.durationMinutes, state, students: this.session.students.length }
  }

  /** Answers are accepted until the deadline plus the grace period. */
  acceptingAnswers() {
    return this.session.state === 'running' && this.now() <= this.closingTime()
  }

  find(token) {
    const student = typeof token === 'string' && token ? this.session.students.find((candidate) => candidate.token === token) : undefined
    if (!student) throw new ClassroomError(401, 'unknown-student', 'This laptop is not registered in the exam. Join again.')
    return student
  }

  view(student, withExam = false) {
    const { id, roomName, state, startedAt, deadline, exam, paper } = this.session
    const result = {
      serverNow: this.now(),
      session: { id, roomName, examTitle: exam.title, durationMinutes: exam.durationMinutes, state, startedAt, deadline },
      student: {
        id: student.id,
        name: student.name,
        className: student.className,
        status: student.status,
        submittedAt: student.submittedAt,
        autoCollected: student.autoCollected,
      },
    }
    // The questions stay on the teacher's machine until the exam has started.
    if (withExam && state !== 'lobby') {
      result.exam = paper
      result.answers = student.answers
    }
    return result
  }

  join(body) {
    const name = cleanText(body?.name)
    const className = cleanText(body?.className)
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 80) : ''
    if (!name || !className) throw new ClassroomError(400, 'missing-identity', 'Enter your name and your class.')
    if (!deviceId) throw new ClassroomError(400, 'bad-request', 'The request is malformed.')
    const time = this.now()
    // A laptop that joined before (after a restart, say) continues its own sitting.
    let student = this.session.students.find((candidate) => candidate.deviceId === deviceId)
    if (student) {
      student.events.push({ at: time, type: 'rejoined' })
    } else {
      if (this.session.state === 'ended') throw new ClassroomError(403, 'ended', 'This exam has ended.')
      if (this.session.students.length >= MAX_STUDENTS) throw new ClassroomError(403, 'full', 'The classroom is full.')
      student = {
        id: crypto.randomUUID(),
        token: crypto.randomBytes(24).toString('hex'),
        deviceId,
        name,
        className,
        joinedAt: time,
        status: 'working',
        submittedAt: null,
        autoCollected: false,
        answers: {},
        marks: {},
        events: [{ at: time, type: 'joined' }],
        source: 'classroom',
      }
      this.session.students.push(student)
    }
    this.onChange()
    return { token: student.token, ...this.view(student, true) }
  }

  saveAnswers(token, answers) {
    const student = this.find(token)
    if (!this.acceptingAnswers()) throw new ClassroomError(409, 'closed', 'The exam is not open for answers.')
    if (student.status !== 'working') throw new ClassroomError(409, 'submitted', 'Your answers are submitted. Withdraw the submission to change them.')
    student.answers = cleanAnswers(answers)
    this.onChange()
    return this.view(student)
  }

  submit(token, answers) {
    const student = this.find(token)
    if (!this.acceptingAnswers()) throw new ClassroomError(409, 'closed', 'The exam is not open for answers.')
    if (student.status === 'working') {
      if (answers !== undefined) student.answers = cleanAnswers(answers)
      // After the deadline it is the laptop handing in what was written when the time ran out.
      const late = this.now() > this.session.deadline
      student.status = 'submitted'
      student.submittedAt = late ? this.session.deadline : this.now()
      student.autoCollected = late
      student.events.push({ at: student.submittedAt, type: late ? 'collected' : 'submitted' })
      this.onChange()
    }
    return this.view(student)
  }

  /** A student may take the answers back to change them, but only while time remains. */
  unsubmit(token) {
    const student = this.find(token)
    if (this.session.state !== 'running' || this.now() >= this.session.deadline) throw new ClassroomError(409, 'closed', 'The exam time is over; the submission can no longer be withdrawn.')
    if (student.status === 'submitted') {
      student.status = 'working'
      student.submittedAt = null
      student.events.push({ at: this.now(), type: 'unsubmitted' })
      this.onChange()
    }
    return this.view(student)
  }

  begin() {
    if (this.session.state !== 'lobby') return
    this.session.state = 'running'
    this.session.startedAt = this.now()
    this.session.deadline = this.session.startedAt + this.session.exam.durationMinutes * 60_000
    this.onChange()
  }

  /** Adds time for everyone (a negative value shortens the exam). */
  extend(minutes) {
    if (this.session.state !== 'running' || !Number.isFinite(minutes)) return
    this.session.deadline = Math.max(this.now(), this.session.deadline + minutes * 60_000)
    this.onChange()
  }

  /** Stops the clock now. The laptops hand in what they have during the grace period. */
  end() {
    if (this.session.state !== 'running') return
    this.session.deadline = Math.min(this.session.deadline, this.now())
    this.onChange()
    this.tick()
  }

  /** Closes the sitting once the deadline and the grace period have passed. */
  tick() {
    if (this.now() > this.closingTime()) this.finish()
  }

  /** Ends the sitting and takes in the answers of everyone who has not handed in. */
  finish() {
    if (this.session.state !== 'running') return
    this.session.deadline = Math.min(this.session.deadline, this.now())
    this.session.state = 'ended'
    this.session.endedAt = this.session.deadline
    for (const student of this.session.students) {
      if (student.status !== 'working') continue
      student.status = 'submitted'
      student.submittedAt = this.session.deadline
      student.autoCollected = true
      student.events.push({ at: this.session.deadline, type: 'collected' })
    }
    this.onChange()
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new ClassroomError(413, 'too-large', 'The request is too large.'))
        request.destroy()
      } else chunks.push(chunk)
    })
    request.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new ClassroomError(400, 'bad-request', 'The request is not valid JSON.'))
      }
    })
    request.on('error', reject)
  })
}

/** The HTTP interface the student laptops talk to. Teacher actions are not reachable through it. */
function createRequestHandler(classroom) {
  const routes = {
    'GET /api/room': () => classroom.roomInfo(),
    'POST /api/join': (_token, body) => classroom.join(body),
    'GET /api/state': (token) => classroom.view(classroom.find(token)),
    'GET /api/exam': (token) => classroom.view(classroom.find(token), true),
    'PUT /api/answers': (token, body) => classroom.saveAnswers(token, body.answers),
    'POST /api/submit': (token, body) => classroom.submit(token, body.answers),
    'POST /api/unsubmit': (token) => classroom.unsubmit(token),
  }
  return async (request, response) => {
    // The student app is loaded from disk, so every request is cross-origin.
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      // Chromium asks for this before a page may call an address on the local network.
      'Access-Control-Allow-Private-Network': 'true',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    }
    const send = (status, payload) => {
      response.writeHead(status, headers)
      response.end(JSON.stringify(payload))
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers)
      return response.end()
    }
    try {
      const route = routes[`${request.method} ${new URL(request.url, 'http://classroom').pathname}`]
      if (!route) throw new ClassroomError(404, 'not-found', 'Not found.')
      const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1]
      const body = request.method === 'GET' ? {} : await readBody(request)
      classroom.tick()
      send(200, route(token, body ?? {}))
    } catch (error) {
      if (error instanceof ClassroomError) send(error.status, { error: error.code, message: error.message })
      else send(500, { error: 'internal', message: 'The classroom could not handle the request.' })
    }
  }
}

/** IPv4 addresses of this machine on its local networks, with their broadcast addresses. */
function localAddresses() {
  const addresses = []
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      const ip = entry.address.split('.').map(Number)
      const mask = entry.netmask.split('.').map(Number)
      addresses.push({ name, address: entry.address, broadcast: ip.map((part, index) => (part | (~mask[index] & 255)) & 255).join('.') })
    }
  }
  return addresses
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', reject)
      resolve(server.address().port)
    })
  })
}

/**
 * Opens a classroom on the network: the HTTP interface, the reply to the
 * students' search for classrooms, and the clock that closes the sitting.
 */
async function hostClassroom(classroom, { port = HTTP_PORT, discoveryPort = DISCOVERY_PORT } = {}) {
  const server = http.createServer(createRequestHandler(classroom))
  let boundPort
  try {
    boundPort = await listen(server, port)
  } catch (error) {
    if (error.code !== 'EADDRINUSE' || port === 0) throw error
    // The usual port is taken; the students find the other one through the search.
    boundPort = await listen(server, 0)
  }

  let discovery = null
  let discoverable = false
  if (discoveryPort !== null) {
    discovery = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    discovery.on('message', (message, remote) => {
      if (message.toString('utf8') !== DISCOVERY_QUERY) return
      discovery.send(JSON.stringify({ ...classroom.roomInfo(), port: boundPort }), remote.port, remote.address)
    })
    discoverable = await new Promise((resolve) => {
      discovery.once('error', () => resolve(false))
      discovery.bind(discoveryPort, () => resolve(true))
    })
    discovery.on('error', () => {})
  }

  const timer = setInterval(() => classroom.tick(), 1000)
  return {
    port: boundPort,
    discoverable,
    close() {
      clearInterval(timer)
      discovery?.close()
      server.closeAllConnections()
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

/**
 * Looks for classrooms on the local networks. The student's laptop asks and
 * the teacher's answers, so only the teacher's firewall has to let anything in.
 */
function discoverClassrooms({ timeoutMs = 1200, discoveryPort = DISCOVERY_PORT } = {}) {
  return new Promise((resolve) => {
    const rooms = new Map()
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    const finish = () => {
      try {
        socket.close()
      } catch {
        // Already closed.
      }
      resolve([...rooms.values()])
    }
    socket.on('error', finish)
    socket.on('message', (message, remote) => {
      try {
        const room = JSON.parse(message.toString('utf8'))
        if (room?.app !== 'virtual-optics-lab' || typeof room.port !== 'number') return
        rooms.set(`${remote.address}:${room.port}`, {
          address: remote.address,
          port: room.port,
          roomName: String(room.roomName ?? ''),
          examTitle: String(room.examTitle ?? ''),
          state: String(room.state ?? ''),
        })
      } catch {
        // Not a classroom reply.
      }
    })
    socket.bind(0, () => {
      socket.setBroadcast(true)
      const targets = new Set(['255.255.255.255', '127.0.0.1', ...localAddresses().map((entry) => entry.broadcast)])
      for (const target of targets) socket.send(DISCOVERY_QUERY, discoveryPort, target, () => {})
      setTimeout(finish, timeoutMs)
    })
  })
}

module.exports = { Classroom, ClassroomError, GRACE_MS, HTTP_PORT, DISCOVERY_PORT, createRequestHandler, discoverClassrooms, hostClassroom, localAddresses }
