/**
 * Physical description of the components that can sit on the optical bench.
 * Every length is in metres; `x` is the position along the optical axis.
 *
 * To add a new component type, add its interface here and teach
 * `optics.ts` (the system solver) how it acts on the light.
 */

export type SlitOrientation = 'vertical' | 'horizontal'
export type ObjectShape = 'arrow' | 'rectangle' | 'circle' | 'letter' | 'cross'
export const OBJECT_SHAPES: readonly ObjectShape[] = ['arrow', 'rectangle', 'circle', 'letter', 'cross']

interface ComponentBase {
  id: string
  x: number
}

export interface LaserComponent extends ComponentBase {
  kind: 'laser'
  /** One of the He-Ne emission lines in constants.ts. */
  lineId: string
}

export interface TungstenComponent extends ComponentBase {
  kind: 'tungsten'
  /** Radiant output as a fraction of full power, 0..1. */
  intensity: number
  /** Diameter of the emitting aperture (extended source). */
  sourceSize: number
}

export interface LensComponent extends ComponentBase {
  kind: 'lens'
  focalLength: number
  /** Clear aperture diameter. */
  aperture: number
  /** When true the focal length is hidden from the student ("unknown lens"). */
  concealed: boolean
}

export interface SingleSlitComponent extends ComponentBase {
  kind: 'singleSlit'
  width: number
  /** Direction of the slit's long axis. */
  orientation: SlitOrientation
}

export interface DoubleSlitComponent extends ComponentBase {
  kind: 'doubleSlit'
  width: number
  /** Centre-to-centre separation. */
  separation: number
  orientation: SlitOrientation
}

export interface ObjectComponent extends ComponentBase {
  kind: 'object'
  shape: ObjectShape
  /** The object stands on the optical axis and extends to this height. */
  height: number
  letter: string
}

export interface ScreenComponent extends ComponentBase {
  kind: 'screen'
}

export type BenchComponent =
  | LaserComponent
  | TungstenComponent
  | LensComponent
  | SingleSlitComponent
  | DoubleSlitComponent
  | ObjectComponent
  | ScreenComponent

export type ComponentKind = BenchComponent['kind']
export type SourceComponent = LaserComponent | TungstenComponent
export type ApertureComponent = SingleSlitComponent | DoubleSlitComponent

export type DiffractionModel = 'fraunhofer' | 'fresnel'
