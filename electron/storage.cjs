// Records kept on the teacher's machine: one JSON file per exam and per sitting.
const fs = require('node:fs')
const path = require('node:path')

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

/** A folder of JSON documents addressed by id. Writes replace the file atomically. */
function createJsonStore(directory) {
  const fileOf = (id) => {
    if (typeof id !== 'string' || !SAFE_ID.test(id)) throw new Error('Invalid record id')
    return path.join(directory, `${id}.json`)
  }
  return {
    directory,
    list() {
      if (!fs.existsSync(directory)) return []
      const documents = []
      for (const name of fs.readdirSync(directory)) {
        if (!name.endsWith('.json')) continue
        try {
          documents.push(JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')))
        } catch {
          // A damaged file is left alone rather than hidden by deleting it.
        }
      }
      return documents
    },
    read(id) {
      try {
        return JSON.parse(fs.readFileSync(fileOf(id), 'utf8'))
      } catch {
        return null
      }
    },
    write(id, document) {
      const file = fileOf(id)
      fs.mkdirSync(directory, { recursive: true })
      const temporary = `${file}.tmp`
      fs.writeFileSync(temporary, JSON.stringify(document))
      fs.renameSync(temporary, file)
    },
    remove(id) {
      fs.rmSync(fileOf(id), { force: true })
    },
  }
}

module.exports = { createJsonStore }
