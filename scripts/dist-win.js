// Builds one edition's Windows installer: `node scripts/dist-win.js <electron-builder config>`.
// Off Windows and without wine, the stand-in in scripts/no-wine takes wine's place.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const config = process.argv[2]
const env = { ...process.env }
const hasWine = process.platform === 'win32' || spawnSync('wine', ['--version'], { stdio: 'ignore' }).status === 0
if (!hasWine) env.PATH = `${path.resolve('scripts/no-wine')}${path.delimiter}${env.PATH}`

const result = spawnSync('npx', ['electron-builder', '--win', 'nsis', '--x64', '--config', config, '--publish', 'never'], { stdio: 'inherit', env, shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
