import { describe, expect, it } from 'vitest'
import updatesModule from '../updates.cjs'

const { checkForUpdate, isNewer, updateFrom } = updatesModule

const asset = (name) => ({ name, browser_download_url: `https://github.com/mus092tafa/virtual-optics-lab/releases/download/v1.3.0/${name}` })

const release = {
  tag_name: 'v1.3.0',
  html_url: 'https://github.com/mus092tafa/virtual-optics-lab/releases/tag/v1.3.0',
  draft: false,
  prerelease: false,
  assets: [asset('VirtualOpticsLab-Teacher-1.3.0-setup.exe'), asset('VirtualOpticsLab-Student-1.3.0-setup.exe')],
}

describe('isNewer', () => {
  it('compares the numbers, not the text', () => {
    expect(isNewer('v1.10.0', '1.9.0')).toBe(true)
    expect(isNewer('1.2.10', '1.2.9')).toBe(true)
    expect(isNewer('2.0.0', '1.99.99')).toBe(true)
  })

  it('offers nothing for the same or an older version', () => {
    expect(isNewer('v1.2.0', '1.2.0')).toBe(false)
    expect(isNewer('v1.1.9', '1.2.0')).toBe(false)
  })

  it('ignores a tag that is not a version', () => {
    expect(isNewer('nightly', '1.2.0')).toBe(false)
    expect(isNewer('v1.3', '1.2.0')).toBe(false)
  })
})

describe('updateFrom', () => {
  it("links each edition to its own installer", () => {
    expect(updateFrom(release, { version: '1.2.0', edition: 'admin' })).toEqual({
      version: '1.3.0',
      url: release.assets[0].browser_download_url,
      page: release.html_url,
    })
    expect(updateFrom(release, { version: '1.2.0', edition: 'student' })?.url).toBe(release.assets[1].browser_download_url)
  })

  it('falls back to the release page when the installer is missing', () => {
    expect(updateFrom({ ...release, assets: [] }, { version: '1.2.0', edition: 'admin' })?.url).toBe(release.html_url)
  })

  it('offers nothing when up to date, for drafts and pre-releases, or without a safe link', () => {
    expect(updateFrom(release, { version: '1.3.0', edition: 'admin' })).toBeNull()
    expect(updateFrom({ ...release, draft: true }, { version: '1.2.0', edition: 'admin' })).toBeNull()
    expect(updateFrom({ ...release, prerelease: true }, { version: '1.2.0', edition: 'admin' })).toBeNull()
    expect(updateFrom({ ...release, assets: [], html_url: 'file:///C:/x.exe' }, { version: '1.2.0', edition: 'admin' })).toBeNull()
    expect(updateFrom(null, { version: '1.2.0', edition: 'admin' })).toBeNull()
  })
})

describe('checkForUpdate', () => {
  const answer = (status, body) => async () => ({ ok: status === 200, status, json: async () => body })

  it('reads the latest release', async () => {
    expect((await checkForUpdate({ version: '1.2.0', edition: 'admin', fetch: answer(200, release) }))?.version).toBe('1.3.0')
  })

  it('answers null offline or when GitHub refuses, instead of failing', async () => {
    const offline = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await checkForUpdate({ version: '1.2.0', edition: 'admin', fetch: offline })).toBeNull()
    expect(await checkForUpdate({ version: '1.2.0', edition: 'admin', fetch: answer(403, { message: 'rate limit' }) })).toBeNull()
  })
})
