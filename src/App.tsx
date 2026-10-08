import { BenchWorkspace } from './components/BenchWorkspace'
import { Header } from './components/Header'
import { InterferometerWorkspace } from './components/interferometer/InterferometerWorkspace'
import { SurfaceWorkspace } from './components/surface/SurfaceWorkspace'
import { useLab } from './state/labState'

export default function App() {
  const section = useLab((s) => s.section)
  return (
    <div className="app">
      <Header />
      {section === 'bench' ? <BenchWorkspace /> : section === 'surface' ? <SurfaceWorkspace /> : <InterferometerWorkspace />}
    </div>
  )
}
