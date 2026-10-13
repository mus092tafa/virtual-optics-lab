import { describe, expect, it } from 'vitest'
import { EYE_RANGES } from '../../physics/constants'
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

  it('has a preset for each eye experiment', () => {
    expect(eyePreset('eye-accommodation')).not.toBeNull()
    expect(eyePreset('eye-glasses')!.objectDistance).toBeNull()
    expect(eyePreset('eye-ageing')!.objectDistance).toBeCloseTo(cm(40), 12)
    expect(eyePreset('convex-lens')).toBeNull()
  })
})
