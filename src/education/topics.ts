/**
 * The experiments grouped by what they are about. The laboratory shows one
 * group at a time, so that the list stays readable as experiments are added.
 */
import type { ExperimentId } from '../state/presets'

export type TopicId = 'surfaces' | 'imaging' | 'beams' | 'waves' | 'polarisation'

export interface Topic {
  id: TopicId
  name: string
  /** In the order they are offered. */
  experiments: ExperimentId[]
}

export const TOPICS: readonly Topic[] = [
  { id: 'surfaces', name: 'Rays & Surfaces', experiments: ['reflection', 'refraction', 'brewster', 'prism'] },
  { id: 'imaging', name: 'Lenses & Mirrors', experiments: ['convex-lens', 'magnification', 'tungsten', 'concave-lens', 'concave-mirror'] },
  { id: 'beams', name: 'Laser Beams', experiments: ['hene-lens'] },
  { id: 'waves', name: 'Diffraction & Interference', experiments: ['single-slit', 'double-slit', 'grating', 'airy', 'michelson'] },
  { id: 'polarisation', name: 'Polarisation', experiments: ['malus'] },
]

export function topicOf(id: ExperimentId): Topic {
  return TOPICS.find((topic) => topic.experiments.includes(id)) ?? TOPICS[0]
}
