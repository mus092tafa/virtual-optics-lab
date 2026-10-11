import { useLab } from '../../state/labState'
import { BenchWorkspace } from '../BenchWorkspace'
import { InterferometerWorkspace } from '../interferometer/InterferometerWorkspace'
import { PrismWorkspace } from '../surface/PrismWorkspace'
import { SurfaceWorkspace } from '../surface/SurfaceWorkspace'

/** The apparatus of the section the laboratory is in. */
export function LabWorkspace() {
  const section = useLab((s) => s.section)
  const experiment = useLab((s) => s.experiment)
  if (section === 'bench') return <BenchWorkspace />
  if (section === 'interferometer') return <InterferometerWorkspace />
  return experiment === 'prism' ? <PrismWorkspace /> : <SurfaceWorkspace />
}
