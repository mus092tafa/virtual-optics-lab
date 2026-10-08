import { BenchWorkspace } from './components/BenchWorkspace'
import { Header } from './components/Header'
import { SurfaceWorkspace } from './components/surface/SurfaceWorkspace'
import { useLab } from './state/labState'

export default function App() {
  const section = useLab((s) => s.section)
  return (
    <div className="app">
      <Header />
      {section === 'bench' ? <BenchWorkspace /> : <SurfaceWorkspace />}
    </div>
  )
}
