/**
 * Application state for the laboratory and the actions that modify it.
 * Holds only the physical configuration and view settings; everything that is
 * observed is derived from it by the physics layer.
 */
import { HENE_LINES, LENS_FOCAL_LENGTHS, MIN_COMPONENT_GAP, POSITION_SNAP, RAIL_LENGTH } from '../physics/constants'
import type { SurfaceSetup } from '../physics/surface'
import type { BenchComponent, ComponentKind, DiffractionModel } from '../physics/types'
import { cm, mm, um } from '../physics/units'
import { DEFAULT_EXPERIMENT, benchPreset, createComponent, surfacePreset } from './presets'
import type { BenchView, ExperimentId } from './presets'
import { createStore, useStore } from './store'

export type LabMode = 'experiment' | 'learning' | 'demonstration'
export type LabSection = 'bench' | 'surface' | 'interferometer'

export interface SurfaceState extends SurfaceSetup {
  showNormal: boolean
  showProtractor: boolean
  /** Direction of the protractor's 0° line, as a polar angle. */
  protractorAngle: number
}

/** Michelson interferometer settings (lengths in metres, angles in radians). */
export interface InterferometerState {
  lineId: string
  /** When true the wavelength is hidden from the student ("unknown laser"). */
  concealed: boolean
  /** Focal length of the beam-expanding lens; null when removed. */
  expanderFocalLength: number | null
  armLength: number
  splitterToScreen: number
  /** Micrometer reading of M2: coarse and fine parts of the displacement d. */
  coarse: number
  fine: number
  tiltX: number
  tiltY: number
  /** Interference order at the centre when the fringe counter was last reset. */
  counterReference: number | null
}

export const DEFAULT_INTERFEROMETER: InterferometerState = {
  lineId: 'red',
  concealed: false,
  expanderFocalLength: cm(2),
  armLength: cm(15),
  splitterToScreen: cm(25),
  coarse: mm(4),
  fine: 0,
  tiltX: 0,
  tiltY: 0,
  counterReference: null,
}

export const FINE_RANGE = um(30)
export const COARSE_RANGE = mm(5)
export const TILT_RANGE = 1e-3

export interface NotebookResult {
  label: string
  value: number
  unit: string
  /** Accepted value, shown only once the student asks for it. */
  theory: number | null
  digits: number
}

export interface NotebookRow {
  id: string
  values: Record<string, number>
  results: NotebookResult[]
}

export interface LabState {
  section: LabSection
  experiment: ExperimentId
  mode: LabMode
  /** In experiment mode: has the student asked to see the theoretical values? */
  revealed: boolean
  components: BenchComponent[]
  selectedId: string | null
  view: BenchView
  showRays: boolean
  rulerTool: boolean
  /** Draw the laser beam with its width exaggerated (display only). */
  beamZoom: boolean
  diffractionModel: DiffractionModel
  surface: SurfaceState
  interferometer: InterferometerState
  screenFov: number
  exposure: number
  showProfile: boolean
  notebook: Partial<Record<ExperimentId, NotebookRow[]>>
}

const SECTION_OF: Record<ExperimentId, LabSection> = {
  reflection: 'surface',
  refraction: 'surface',
  'convex-lens': 'bench',
  magnification: 'bench',
  'hene-lens': 'bench',
  'single-slit': 'bench',
  'double-slit': 'bench',
  tungsten: 'bench',
  michelson: 'interferometer',
}

const DEFAULT_OF_SECTION: Record<LabSection, ExperimentId> = {
  surface: 'reflection',
  bench: 'convex-lens',
  interferometer: 'michelson',
}

const DEFAULT_SURFACE: SurfaceState = {
  ...surfacePreset('reflection')!,
  showNormal: true,
  showProtractor: true,
  protractorAngle: Math.PI / 2,
}

function initialState(): LabState {
  const preset = benchPreset(DEFAULT_EXPERIMENT)!
  return {
    section: 'bench',
    experiment: DEFAULT_EXPERIMENT,
    mode: 'learning',
    revealed: false,
    components: preset.components,
    selectedId: null,
    view: preset.view,
    showRays: false,
    rulerTool: false,
    beamZoom: false,
    diffractionModel: 'fraunhofer',
    surface: DEFAULT_SURFACE,
    interferometer: DEFAULT_INTERFEROMETER,
    screenFov: preset.screenFov,
    exposure: 1,
    showProfile: true,
    notebook: {},
  }
}

const STORAGE_KEY = 'virtual-optics-lab/v1'

function loadPersisted(): LabState {
  const base = initialState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    return mergeConfiguration(base, JSON.parse(raw))
  } catch {
    return base
  }
}

/** Accepts a saved configuration, ignoring anything malformed. */
export function mergeConfiguration(base: LabState, data: unknown): LabState {
  if (typeof data !== 'object' || data === null) return base
  const saved = data as Partial<LabState>
  const components = Array.isArray(saved.components)
    ? saved.components.filter((c) => c && typeof c.id === 'string' && typeof c.x === 'number' && typeof c.kind === 'string')
    : base.components
  return {
    ...base,
    ...saved,
    components,
    selectedId: null,
    surface: { ...base.surface, ...(saved.surface ?? {}) },
    interferometer: { ...base.interferometer, ...(saved.interferometer ?? {}) },
    view: saved.view && saved.view.x1 > saved.view.x0 ? saved.view : base.view,
    notebook: saved.notebook ?? {},
  }
}

export const labStore = createStore<LabState>(loadPersisted())

let persistTimer: ReturnType<typeof setTimeout> | undefined
labStore.subscribe(() => {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(labStore.get()))
    } catch {
      // Storage may be unavailable (private mode); the lab still works.
    }
  }, 300)
})

export function useLab<S>(selector: (state: LabState) => S): S {
  return useStore(labStore, selector)
}

/** Theory is visible outside experiment mode, or once the student reveals it. */
export function theoryVisible(state: Pick<LabState, 'mode' | 'revealed'>): boolean {
  return state.mode !== 'experiment' || state.revealed
}

const update = (patch: Partial<LabState> | ((state: LabState) => Partial<LabState>)) =>
  labStore.set((state) => ({ ...state, ...(typeof patch === 'function' ? patch(state) : patch) }))

const SINGLETON_GROUPS: ComponentKind[][] = [['laser', 'tungsten'], ['singleSlit', 'doubleSlit'], ['object'], ['screen']]
export const MAX_LENSES = 3

export function snapPosition(x: number, step = POSITION_SNAP): number {
  return Math.min(RAIL_LENGTH, Math.max(0, Math.round(x / step) * step))
}

/**
 * Keeps carriers from occupying the same place on the rail: a position closer
 * than the minimum gap to a neighbour is pushed to the nearer free side.
 */
export function resolvePosition(components: readonly BenchComponent[], id: string, desired: number): number {
  let x = snapPosition(desired)
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const other of components) {
      if (other.id === id) continue
      if (Math.abs(x - other.x) < MIN_COMPONENT_GAP - 1e-9) {
        const side = desired >= other.x ? 1 : -1
        const candidate = other.x + side * MIN_COMPONENT_GAP
        x = candidate < 0 || candidate > RAIL_LENGTH ? other.x - side * MIN_COMPONENT_GAP : candidate
        moved = true
      }
    }
    if (!moved) break
  }
  return snapPosition(x)
}

function freePosition(components: readonly BenchComponent[], view: BenchView, kind: ComponentKind): number {
  const span = view.x1 - view.x0
  const preferred = kind === 'laser' || kind === 'tungsten' ? 0.06 : kind === 'screen' ? 0.9 : 0.5
  let x = snapPosition(view.x0 + span * preferred, cm(1))
  const taken = (candidate: number) => components.some((c) => Math.abs(c.x - candidate) < cm(2))
  for (let i = 0; i < 80 && taken(x); i++) x = snapPosition(x + cm(2) > view.x1 ? view.x0 + cm(2) : x + cm(2), cm(1))
  return x
}

export const actions = {
  loadExperiment(id: ExperimentId) {
    update((state) => {
      const section = SECTION_OF[id]
      const common = { experiment: id, section, revealed: false, selectedId: null, rulerTool: false }
      if (section === 'interferometer') {
        return { ...common, interferometer: DEFAULT_INTERFEROMETER, screenFov: mm(40), exposure: 1 }
      }
      if (section === 'surface') {
        return { ...common, surface: { ...state.surface, ...surfacePreset(id)!, protractorAngle: Math.PI / 2 } }
      }
      const preset = benchPreset(id)!
      return {
        ...common,
        components: preset.components,
        view: preset.view,
        screenFov: preset.screenFov,
        exposure: 1,
        beamZoom: id === 'hene-lens',
        diffractionModel: 'fraunhofer' as const,
        showRays: state.mode === 'demonstration' && (id === 'convex-lens' || id === 'magnification' || id === 'tungsten'),
      }
    })
  },
  resetLaboratory() {
    actions.loadExperiment(labStore.get().experiment)
  },
  clearBench() {
    update({ components: [], selectedId: null })
  },
  setSection(section: LabSection) {
    const state = labStore.get()
    if (state.section === section) return
    // Switch to an experiment that belongs to the section, keeping the layout.
    const experiment = SECTION_OF[state.experiment] === section ? state.experiment : DEFAULT_OF_SECTION[section]
    // The screen view is shared; give the interferometer a field that shows its fringes.
    update({ section, experiment, revealed: false, ...(section === 'interferometer' ? { screenFov: mm(40), exposure: 1 } : {}) })
  },
  setMode(mode: LabMode) {
    update({ mode, revealed: false })
  },
  setRevealed(revealed: boolean) {
    update({ revealed })
  },
  select(id: string | null) {
    update({ selectedId: id })
  },
  addComponent(kind: ComponentKind) {
    update((state) => {
      let components = state.components
      // Only one source, one aperture, one object and one screen can be mounted.
      const group = SINGLETON_GROUPS.find((kinds) => kinds.includes(kind))
      let x: number | null = null
      if (group) {
        const existing = components.find((c) => group.includes(c.kind))
        if (existing) {
          x = existing.x
          components = components.filter((c) => c.id !== existing.id)
        }
      } else if (kind === 'lens' && components.filter((c) => c.kind === 'lens').length >= MAX_LENSES) {
        return {}
      }
      const component = createComponent(kind, x ?? freePosition(components, state.view, kind))
      return { components: [...components, component], selectedId: component.id }
    })
  },
  removeComponent(id: string) {
    update((state) => ({
      components: state.components.filter((c) => c.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }))
  },
  moveComponent(id: string, x: number) {
    update((state) => {
      const resolved = resolvePosition(state.components, id, x)
      const current = state.components.find((c) => c.id === id)
      if (!current || current.x === resolved) return {}
      return { components: state.components.map((c) => (c.id === id ? { ...c, x: resolved } : c)) }
    })
  },
  updateComponent(id: string, patch: Partial<BenchComponent>) {
    update((state) => ({
      components: state.components.map((c) => (c.id === id ? ({ ...c, ...patch } as BenchComponent) : c)),
    }))
  },
  /** Swaps a lens for one of unknown focal length (experiment mode). */
  useUnknownLens(id: string) {
    const focalLength = LENS_FOCAL_LENGTHS[Math.floor(Math.random() * LENS_FOCAL_LENGTHS.length)]
    actions.updateComponent(id, { focalLength, concealed: true } as Partial<BenchComponent>)
    update({ revealed: false })
  },
  setView(view: BenchView) {
    const span = Math.min(RAIL_LENGTH + cm(17), Math.max(cm(8), view.x1 - view.x0))
    const x0 = Math.min(RAIL_LENGTH + cm(5) - span, Math.max(-cm(12), view.x0))
    update({ view: { x0, x1: x0 + span } })
  },
  fitView() {
    update({ view: { x0: -cm(12), x1: RAIL_LENGTH + cm(5) } })
  },
  set<K extends 'showRays' | 'rulerTool' | 'beamZoom' | 'diffractionModel' | 'exposure' | 'showProfile'>(key: K, value: LabState[K]) {
    update({ [key]: value } as Partial<LabState>)
  },
  setScreenFov(fov: number) {
    update({ screenFov: Math.min(mm(120), Math.max(mm(0.2), fov)) })
  },
  updateSurface(patch: Partial<SurfaceState>) {
    update((state) => ({ surface: { ...state.surface, ...patch } }))
  },
  updateInterferometer(patch: Partial<InterferometerState>) {
    update((state) => {
      const next = { ...state.interferometer, ...patch }
      next.coarse = Math.min(COARSE_RANGE, Math.max(-COARSE_RANGE, next.coarse))
      next.fine = Math.min(FINE_RANGE, Math.max(-FINE_RANGE, next.fine))
      next.tiltX = Math.min(TILT_RANGE, Math.max(-TILT_RANGE, next.tiltX))
      next.tiltY = Math.min(TILT_RANGE, Math.max(-TILT_RANGE, next.tiltY))
      return { interferometer: next }
    })
  },
  /** Swaps the laser for one of the He-Ne lines without telling the student which. */
  useUnknownLaser() {
    const line = HENE_LINES[Math.floor(Math.random() * HENE_LINES.length)]
    actions.updateInterferometer({ lineId: line.id, concealed: true, counterReference: null })
    update({ revealed: false })
  },
  addNotebookRow(row: NotebookRow) {
    update((state) => ({
      notebook: { ...state.notebook, [state.experiment]: [...(state.notebook[state.experiment] ?? []), row] },
    }))
  },
  removeNotebookRow(id: string) {
    update((state) => ({
      notebook: {
        ...state.notebook,
        [state.experiment]: (state.notebook[state.experiment] ?? []).filter((row) => row.id !== id),
      },
    }))
  },
  clearNotebook() {
    update((state) => ({ notebook: { ...state.notebook, [state.experiment]: [] } }))
  },
  /** Serialises the physical configuration for saving to a file. */
  exportConfiguration(): string {
    const { selectedId: _selected, ...rest } = labStore.get()
    return JSON.stringify({ format: 'virtual-optics-lab', version: 1, ...rest }, null, 2)
  },
  importConfiguration(text: string): boolean {
    try {
      const data = JSON.parse(text)
      if (data?.format !== 'virtual-optics-lab') return false
      labStore.set((state) => mergeConfiguration(state, data))
      return true
    } catch {
      return false
    }
  },
}
