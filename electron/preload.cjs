// The only bridge between the laboratory page and the desktop shell. The page
// stays sandboxed; it can do no more than what is listed here.
const { contextBridge, ipcRenderer } = require('electron')

const call = (channel) => (payload) => ipcRenderer.invoke(channel, payload)

const subscribe = (channel) => (listener) => {
  const handler = (_event, payload) => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld('opticsDesktop', {
  info: call('app:info'),
  openFile: call('file:open'),
  saveFile: call('file:save'),
  savePdf: call('documents:savePdf'),
  savePdfs: call('documents:savePdfs'),
  takeOpenedFile: call('file:takeOpened'),
  onFileOpened: subscribe('file:opened'),
  discoverClassrooms: call('classroom:discover'),

  // Teacher's edition only; the student build has no handlers behind these.
  listExams: call('exams:list'),
  saveExam: call('exams:save'),
  removeExam: call('exams:remove'),
  listSessions: call('sessions:list'),
  loadSession: call('sessions:load'),
  createSession: call('sessions:create'),
  removeSession: call('sessions:remove'),
  setMark: call('sessions:setMark'),
  importAnswers: call('sessions:importAnswers'),
  removeStudent: call('sessions:removeStudent'),
  finishSession: call('sessions:finish'),
  openClassroom: call('classroom:open'),
  classroomStatus: call('classroom:status'),
  closeClassroom: call('classroom:close'),
  classroomCommand: call('classroom:command'),
  onSessionUpdate: subscribe('session:update'),
  openRecordsFolder: call('records:openFolder'),
})
