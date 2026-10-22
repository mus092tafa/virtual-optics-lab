// Tells whether a newer version has been released. Asks GitHub's public
// releases API, which needs no account; offline (a lab router without
// internet) the question simply goes unanswered. Nothing is downloaded or
// installed here: the teacher or student fetches the new installer.

const RELEASES_URL = 'https://api.github.com/repos/mus092tafa/virtual-optics-lab/releases/latest'
const TIMEOUT_MS = 8000

/** [major, minor, patch] of "1.2.3" or "v1.2.3"; null for anything else. */
function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text ?? '').trim())
  return match ? match.slice(1).map(Number) : null
}

function isNewer(candidate, current) {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index]
  return false
}

/**
 * The update a release offers this edition, or null when it is not newer.
 * The link is the edition's installer, or the release page when the release has none.
 */
function updateFrom(release, { version, edition }) {
  if (!release || release.draft || release.prerelease || !isNewer(release.tag_name, version)) return null
  const prefix = `VirtualOpticsLab-${edition === 'student' ? 'Student' : 'Teacher'}-`
  const installer = (Array.isArray(release.assets) ? release.assets : []).find((asset) => typeof asset?.name === 'string' && asset.name.startsWith(prefix) && asset.name.endsWith('-setup.exe'))
  const page = typeof release.html_url === 'string' ? release.html_url : ''
  const url = typeof installer?.browser_download_url === 'string' ? installer.browser_download_url : page
  if (!/^https:\/\//.test(url)) return null
  return { version: parseVersion(release.tag_name).join('.'), url, page }
}

/** Resolves to the available update or null; never rejects. */
async function checkForUpdate({ version, edition, fetch, url = RELEASES_URL, timeoutMs = TIMEOUT_MS }) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'virtual-optics-lab' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return null
    return updateFrom(await response.json(), { version, edition })
  } catch {
    return null
  }
}

module.exports = { RELEASES_URL, checkForUpdate, isNewer, updateFrom }
