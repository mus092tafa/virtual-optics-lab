import { describe, expect, it } from 'vitest'
import { EYE_ABERRATION_RANGES, EYE_RANGES } from '../../physics/constants'
import { NORMAL_AXIAL_LENGTH, refractiveError, solveEye } from '../../physics/eye'
import { cm, mm } from '../../physics/units'
import { actions, labStore, mergeConfiguration } from '../labState'
import { DEFAULT_EYE, eyeCondition, eyePreset, toEyeSetup } from '../presets'

describe('eye section of the laboratory', () => {
  it('gives a configuration saved before the eye existed the default eye', () => {
    const { eye: _eye, ...older } = JSON.parse(JSON.stringify(labStore.get()))
    const loaded = mergeConfiguration(labStore.get(), older)
    expect(loaded.eye).toEqual(DEFAULT_EYE)
  })

  it('keeps a distant object through a saved file', () => {
    actions.loadExperiment('eye-glasses')
    expect(labStore.get().section).toBe('eye')
    const saved = JSON.parse(JSON.stringify(actions.exportSnapshot()))
    expect(saved.eye.objectDistance).toBeNull()
    actions.loadSnapshot(saved)
    expect(toEyeSetup(labStore.get().eye).objectDistance).toBe(Infinity)
  })

  it('offers the conditions as lengths of the eye and an age', () => {
    const error = (condition: Parameters<typeof eyeCondition>[0]) => refractiveError({ ...DEFAULT_EYE, ...eyeCondition(condition) })
    expect(error('normal')).toBeCloseTo(0, 9)
    expect(error('myopia')).toBeCloseTo(-3, 9)
    expect(error('hyperopia')).toBeCloseTo(3, 9)
    const presbyope = { ...DEFAULT_EYE, ...eyeCondition('presbyopia') }
    expect(presbyope.axialLength).toBe(NORMAL_AXIAL_LENGTH)
    expect(solveEye(toEyeSetup(presbyope)).view.nearPoint!).toBeGreaterThan(cm(40))
  })

  it('keeps every setting inside the range the model covers', () => {
    actions.loadExperiment('eye-accommodation')
    actions.updateEye({ axialLength: mm(40), cornealRadius: mm(1), age: 3, pupilDiameter: mm(20), objectDistance: mm(1), glassesPower: 3.13, vertexDistance: cm(5) })
    const { eye } = labStore.get()
    expect(eye.axialLength).toBe(EYE_RANGES.axialLength.max)
    expect(eye.cornealRadius).toBe(EYE_RANGES.cornealRadius.min)
    expect(eye.age).toBe(EYE_RANGES.age.min)
    expect(eye.pupilDiameter).toBe(EYE_RANGES.pupilDiameter.max)
    expect(eye.objectDistance).toBe(EYE_RANGES.objectDistance.min)
    expect(eye.glassesPower).toBe(3.25)
    expect(eye.vertexDistance).toBe(EYE_RANGES.vertexDistance.max)
  })

  it('does not hold the lens beyond the eye’s age', () => {
    actions.loadExperiment('eye-accommodation')
    actions.updateEye({ age: 55, heldAccommodation: 9 })
    expect(labStore.get().eye.heldAccommodation).toBeCloseTo(2, 9)
  })

  it('conceals the eye of an exam question and keeps it concealed', () => {
    actions.loadExperiment('eye-glasses')
    const snapshot = JSON.parse(JSON.stringify(actions.exportSnapshot()))
    actions.loadSnapshot(snapshot, { lock: { notebook: false }, concealUnknowns: true })
    expect(labStore.get().eye.concealed).toBe(true)
    const before = labStore.get().eye
    actions.useUnknownEye()
    actions.useKnownEye()
    actions.setEyeCondition('normal')
    expect(labStore.get().eye).toEqual(before)
    actions.loadSnapshot(snapshot)
  })

  it('swaps in an unknown eye that is not normal', () => {
    actions.loadExperiment('eye-glasses')
    actions.useUnknownEye()
    const { eye } = labStore.get()
    expect(eye.concealed).toBe(true)
    expect(Math.abs(refractiveError(eye))).toBeGreaterThanOrEqual(1 - 1e-9)
    expect(eye.glassesOn).toBe(false)
    actions.useKnownEye()
    expect(labStore.get().eye.concealed).toBe(false)
  })

  it('loads a configuration saved before the aberrations existed as a symmetric, paraxial eye in white light', () => {
    actions.loadExperiment('eye-glasses')
    const saved = JSON.parse(JSON.stringify(actions.exportSnapshot()))
    for (const key of ['cornealRadiusCross', 'cornealMeridian', 'glassesCylinder', 'glassesAxis', 'wavelength', 'dispersion', 'realRays', 'pupilZone', 'cornealAsphericity', 'lensAsphericity', 'sceneView']) delete saved.eye[key]
    actions.loadExperiment('eye-astigmatism')
    actions.loadSnapshot(saved)
    const { eye } = labStore.get()
    expect(eye.cornealRadiusCross).toBeNull()
    expect(eye.glassesCylinder).toBe(0)
    expect(eye.wavelength).toBeNull()
    expect(eye.dispersion).toBe(false)
    expect(eye.realRays).toBe(false)
    expect(eye.sceneView).toBe('side')
    const solution = solveEye(toEyeSetup(eye))
    expect(solution.astigmatic).toBe(false)
    expect(solution.realRays).toBe(false)
    expect(solution.refractiveError).toBeCloseTo(-3, 9)
  })

  it('offers astigmatism as a second corneal radius, 2 D steeper vertically', () => {
    const astigmat = { ...DEFAULT_EYE, ...eyeCondition('astigmatism') }
    const solution = solveEye(toEyeSetup(astigmat))
    expect(solution.cornealPowerCross - solution.cornealPower).toBeCloseTo(2, 9)
    expect(solution.refraction.cylinder).toBeCloseTo(-2, 6)
    // Every other condition is an eye with one corneal radius again.
    for (const condition of ['normal', 'myopia', 'hyperopia', 'presbyopia'] as const) expect({ ...astigmat, ...eyeCondition(condition) }.cornealRadiusCross).toBeNull()
  })

  it('keeps the new settings within their ranges and directions within half a turn', () => {
    actions.loadExperiment('eye-astigmatism')
    actions.updateEye({ cornealRadiusCross: mm(3), cornealMeridian: Math.PI * 1.25, glassesCylinder: -9.1, glassesAxis: -Math.PI / 4, wavelength: 200e-9, pupilZone: 2, cornealAsphericity: -7, lensAsphericity: 9 })
    const { eye } = labStore.get()
    expect(eye.cornealRadiusCross).toBe(EYE_RANGES.cornealRadius.min)
    expect(eye.cornealMeridian).toBeCloseTo(Math.PI / 4, 12)
    expect(eye.glassesCylinder).toBe(-6)
    expect(eye.glassesAxis).toBeCloseTo((3 * Math.PI) / 4, 12)
    expect(eye.wavelength).toBe(EYE_ABERRATION_RANGES.wavelength.min)
    expect(eye.pupilZone).toBe(EYE_ABERRATION_RANGES.pupilZone.max)
    expect(eye.cornealAsphericity).toBe(EYE_ABERRATION_RANGES.cornealAsphericity.min)
    expect(eye.lensAsphericity).toBe(EYE_ABERRATION_RANGES.lensAsphericity.max)
    actions.updateEye({ glassesCylinder: -1.3 })
    expect(labStore.get().eye.glassesCylinder).toBe(-1.25)
  })

  it('swaps in an unknown astigmatic eye in the astigmatism experiment, and a symmetric one elsewhere', () => {
    actions.loadExperiment('eye-astigmatism')
    actions.useUnknownEye()
    const astigmat = solveEye(toEyeSetup(labStore.get().eye))
    expect(labStore.get().eye.concealed).toBe(true)
    expect(astigmat.astigmatic).toBe(true)
    expect(-astigmat.refraction.cylinder).toBeGreaterThanOrEqual(1 - 1e-6)
    expect(-astigmat.refraction.cylinder).toBeLessThanOrEqual(3 + 1e-6)
    expect(labStore.get().eye.glassesCylinder).toBe(0)
    actions.useKnownEye()
    expect(labStore.get().eye.cornealRadiusCross).toBeNull()
    actions.loadExperiment('eye-glasses')
    actions.useUnknownEye()
    expect(labStore.get().eye.cornealRadiusCross).toBeNull()
    actions.useKnownEye()
  })

  it('starts the aberration experiments with their aberration switched on and the others off', () => {
    const astigmatism = eyePreset('eye-astigmatism')!
    expect(astigmatism.cornealRadiusCross).not.toBeNull()
    expect(astigmatism.chart).toBe('fan')
    expect([astigmatism.dispersion, astigmatism.realRays]).toEqual([false, false])
    const chromatic = eyePreset('eye-chromatic')!
    expect([chromatic.cornealRadiusCross, chromatic.dispersion, chromatic.realRays]).toEqual([null, true, false])
    const spherical = eyePreset('eye-spherical')!
    expect([spherical.cornealRadiusCross, spherical.dispersion, spherical.realRays]).toEqual([null, false, true])
    expect([spherical.cornealAsphericity, spherical.lensAsphericity]).toEqual([0, 0])
  })

  it('has a preset for each eye experiment', () => {
    expect(eyePreset('eye-accommodation')).not.toBeNull()
    expect(eyePreset('eye-glasses')!.objectDistance).toBeNull()
    expect(eyePreset('eye-ageing')!.objectDistance).toBeCloseTo(cm(40), 12)
    expect(eyePreset('convex-lens')).toBeNull()
  })
})
