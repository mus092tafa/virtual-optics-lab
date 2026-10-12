// Desktop shell: opens the built laboratory in a window and provides what a
// web page cannot do on its own — files, PDF output, the records kept on the
// teacher's machine and the classroom network. Nothing here touches the optics.
const { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker, shell } = require('electron')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Classroom, discoverClassrooms, hostClassroom, localAddresses, scanClassrooms } = require('./classroom.cjs')
const { createJsonStore } = require('./storage.cjs')

const EXAM_FILE = /\.(opticsexam|opticsmaster|opticsanswers)$/i

const argument = (name) => process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3)

// The student build is packaged without the exam-writing and marking parts.
// Unpackaged, the edition can be chosen on the command line for development.
const edition = (app.isPackaged ? require('../package.json').edition : argument('edition')) === 'student' ? 'student' : 'admin'
const devUrl = app.isPackaged ? undefined : argument('dev-url')

if (!app.isPackaged) {
  // Keep the two editions (and several test instances) apart when run from source.
  app.setPath('userData', process.env.OPTICS_USER_DATA ?? path.join(app.getPath('appData'), `virtual-optics-lab-${edition}-dev`))
}

let mainWindow = null
/** An exam file the application was started with, until the page asks for it. */
let openedFile = null

function readExamFile(file) {
  try {
    return { name: path.basename(file), text: fs.readFileSync(file, 'utf8') }
  } catch {
    return null
  }
}

function examFileIn(argv) {
  const file = argv.slice(1).find((entry) => EXAM_FILE.test(entry) && fs.existsSync(entry))
  return file ? readExamFile(file) : null
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0b0f14',
    autoHideMenuBar: true,
    title: 'Virtual Optics Laboratory',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  })
  if (devUrl) window.loadURL(devUrl)
  else window.loadFile(path.join(__dirname, '..', edition === 'student' ? 'dist-student' : 'dist', 'index.html'))
  // External links open in the system browser, never inside the lab window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url)
    return { action: 'deny' }
  })
  window.on('close', (event) => {
    if (active?.session.state !== 'running') return
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning',
      buttons: ['Keep the exam running', 'Close anyway'],
      defaultId: 0,
      cancelId: 0,
      message: 'An exam is in progress.',
      detail: 'Closing the application disconnects the students. Their answers so far are saved, and the sitting can be resumed from the records.',
    })
    if (choice === 0) event.preventDefault()
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })
  mainWindow = window
}

// ---------- Files and documents ----------

const filtersFor = (extensions, label) => [{ name: label ?? 'Files', extensions }]

async function openFile(_event, { title, extensions, label }) {
  const result = await dialog.showOpenDialog(mainWindow, { title, properties: ['openFile'], filters: filtersFor(extensions, label) })
  return result.canceled || !result.filePaths[0] ? null : readExamFile(result.filePaths[0])
}

async function saveFile(_event, { defaultName, text, extensions, label }) {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName, filters: filtersFor(extensions, label) })
  if (result.canceled || !result.filePath) return null
  fs.writeFileSync(result.filePath, text, 'utf8')
  return result.filePath
}

/** Lays the document out in a hidden window and prints it to PDF. Works offline. */
async function renderPdf(html) {
  const source = path.join(app.getPath('temp'), `optics-document-${crypto.randomUUID()}.html`)
  fs.writeFileSync(source, html, 'utf8')
  const printer = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } })
  try {
    await printer.loadFile(source)
    return await printer.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
  } finally {
    printer.destroy()
    fs.rmSync(source, { force: true })
  }
}

async function savePdf(_event, { defaultName, html }) {
  const result = await dialog.showSaveDialog(mainWindow, { defaultPath: defaultName, filters: filtersFor(['pdf'], 'PDF document') })
  if (result.canceled || !result.filePath) return null
  fs.writeFileSync(result.filePath, await renderPdf(html))
  return result.filePath
}

async function savePdfs(_event, { items }) {
  const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose a folder for the PDF files', properties: ['openDirectory', 'createDirectory'] })
  if (result.canceled || !result.filePaths[0]) return null
  const taken = new Set()
  for (const item of items) {
    // Two students with the same name must not overwrite each other's sheet.
    let name = path.basename(String(item.name))
    for (let copy = 2; taken.has(name.toLowerCase()); copy++) name = `${path.basename(String(item.name), '.pdf')} (${copy}).pdf`
    taken.add(name.toLowerCase())
    fs.writeFileSync(path.join(result.filePaths[0], name), await renderPdf(item.html))
  }
  return { directory: result.filePaths[0], count: items.length }
}

// ---------- Teacher's records and the classroom (admin edition) ----------

/** The classroom that is open on the network, if any. */
let active = null
let exams = null
let sessions = null

const summarize = (session) => ({
  id: session.id,
  roomName: session.roomName,
  examTitle: session.exam.title,
  createdAt: session.createdAt,
  state: session.state,
  students: session.students.map((student) => ({ name: student.name, className: student.className })),
})

function publish(session) {
  mainWindow?.webContents.send('session:update', session)
}

/** Applies a change to a sitting, whether it is the one in progress or one in the records. */
function changeSession(id, change) {
  if (active?.session.id === id) {
    change(active.session)
    active.changed()
    return active.session
  }
  const session = sessions.read(id)
  if (!session) throw new Error('The sitting is no longer in the records.')
  change(session)
  sessions.write(id, session)
  publish(session)
  return session
}

const studentOf = (session, studentId) => {
  const student = session.students.find((candidate) => candidate.id === studentId)
  if (!student) throw new Error('The student is not part of this sitting.')
  return student
}

async function closeClassroom() {
  if (!active) return
  const closing = active
  active = null
  closing.flush()
  powerSaveBlocker.stop(closing.blocker)
  await closing.host.close()
}

async function openClassroom(_event, { sessionId, teacherName }) {
  await closeClassroom()
  const session = sessions.read(sessionId)
  if (!session) throw new Error('The sitting is no longer in the records.')
  // Students tell classrooms apart by the teacher; without a name they see the computer's.
  session.teacherName = (typeof teacherName === 'string' && teacherName.trim()) || os.hostname()
  let saveTimer
  let publishTimer
  const flush = () => {
    clearTimeout(saveTimer)
    saveTimer = undefined
    sessions.write(session.id, session)
  }
  // Answers arrive from forty laptops every few seconds: batch the disk writes
  // and the updates of the teacher's view.
  const changed = () => {
    saveTimer ??= setTimeout(flush, 400)
    publishTimer ??= setTimeout(() => {
      publishTimer = undefined
      publish(session)
    }, 150)
  }
  const classroom = new Classroom(session, { onChange: changed })
  const host = await hostClassroom(classroom)
  // The teacher's machine must not go to sleep with a class connected to it.
  active = { session, classroom, host, changed, flush, blocker: powerSaveBlocker.start('prevent-app-suspension') }
  return classroomStatus()
}

function classroomStatus() {
  if (!active) return null
  return { session: active.session, port: active.host.port, discoverable: active.host.discoverable, addresses: localAddresses().map((entry) => entry.address), hostName: os.hostname() }
}

function registerAdminHandlers() {
  exams = createJsonStore(path.join(app.getPath('userData'), 'exams'))
  sessions = createJsonStore(path.join(app.getPath('userData'), 'sessions'))

  ipcMain.handle('exams:list', () => exams.list().sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)))
  ipcMain.handle('exams:save', (_event, exam) => exams.write(exam.id, exam))
  ipcMain.handle('exams:remove', (_event, id) => exams.remove(id))

  ipcMain.handle('sessions:list', () =>
    sessions
      .list()
      .map((session) => summarize(active?.session.id === session.id ? active.session : session))
      .sort((a, b) => b.createdAt - a.createdAt),
  )
  ipcMain.handle('sessions:load', (_event, id) => (active?.session.id === id ? active.session : sessions.read(id)))
  ipcMain.handle('sessions:create', (_event, { exam, paper, roomName, state }) => {
    const time = Date.now()
    const session = {
      format: 'optics-session',
      version: 1,
      id: crypto.randomUUID(),
      roomName,
      exam,
      paper,
      createdAt: time,
      startedAt: null,
      deadline: null,
      endedAt: state === 'ended' ? time : null,
      state: state === 'ended' ? 'ended' : 'lobby',
      students: [],
    }
    sessions.write(session.id, session)
    return session
  })
  ipcMain.handle('sessions:remove', async (_event, id) => {
    if (active?.session.id === id) await closeClassroom()
    sessions.remove(id)
  })
  ipcMain.handle('sessions:setMark', (_event, { sessionId, studentId, questionId, mark }) =>
    changeSession(sessionId, (session) => {
      const student = studentOf(session, studentId)
      if (mark) student.marks[questionId] = mark
      else delete student.marks[questionId]
    }),
  )
  ipcMain.handle('sessions:importAnswers', (_event, { sessionId, file }) =>
    changeSession(sessionId, (session) => {
      const time = Date.now()
      session.students.push({
        id: crypto.randomUUID(),
        name: file.name,
        className: file.className,
        joinedAt: file.startedAt,
        status: 'submitted',
        submittedAt: file.submittedAt,
        autoCollected: file.autoCollected,
        answers: file.answers,
        marks: {},
        events: [{ at: time, type: 'imported' }],
        source: 'file',
      })
    }),
  )
  // Ends a sitting whose time ran out while its classroom was closed, without going on the network.
  ipcMain.handle('sessions:finish', (_event, id) => changeSession(id, (session) => new Classroom(session).finish()))
  ipcMain.handle('sessions:removeStudent', (_event, { sessionId, studentId }) =>
    changeSession(sessionId, (session) => {
      session.students = session.students.filter((student) => student.id !== studentId)
    }),
  )

  ipcMain.handle('classroom:open', openClassroom)
  ipcMain.handle('classroom:status', classroomStatus)
  ipcMain.handle('classroom:close', closeClassroom)
  ipcMain.handle('classroom:command', (_event, { command, minutes }) => {
    if (!active) return null
    if (command === 'begin') active.classroom.begin()
    else if (command === 'end') active.classroom.end()
    else if (command === 'extend') active.classroom.extend(minutes)
    return classroomStatus()
  })

  ipcMain.handle('documents:savePdfs', savePdfs)
  ipcMain.handle('records:openFolder', () => {
    fs.mkdirSync(app.getPath('userData'), { recursive: true })
    return shell.openPath(app.getPath('userData'))
  })
}

// ---------- Start-up ----------

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Double-clicking an exam file while the application is open hands it to the open window.
  app.on('second-instance', (_event, argv) => {
    const file = examFileIn(argv)
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    if (file) mainWindow.webContents.send('file:opened', file)
  })

  app.whenReady().then(() => {
    openedFile = examFileIn(process.argv)
    ipcMain.handle('app:info', () => ({ edition, version: app.getVersion(), hostName: os.hostname() }))
    ipcMain.handle('file:takeOpened', () => {
      const file = openedFile
      openedFile = null
      return file
    })
    ipcMain.handle('file:open', openFile)
    ipcMain.handle('file:save', saveFile)
    ipcMain.handle('documents:savePdf', savePdf)
    ipcMain.handle('classroom:discover', async (_event, options) => {
      if (!options?.thorough) return discoverClassrooms()
      const found = (await Promise.all([scanClassrooms(), discoverClassrooms()])).flat()
      return [...new Map(found.map((room) => [`${room.address}:${room.port}`, room])).values()]
    })
    if (edition === 'admin') registerAdminHandlers()

    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', async () => {
    await closeClassroom()
    app.quit()
  })
}
