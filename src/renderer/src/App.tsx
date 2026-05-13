import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { COLOR_THEMES, applyTheme } from './types/settings'
import { PanelLeftOpen } from 'lucide-react'
import { Home } from './pages/Home'
import { Files } from './pages/Files'
import { Notes } from './pages/Notes'
import { AI } from './pages/AI'
import { WhiteboardList } from './pages/WhiteboardList'
import { WhiteboardEditor } from './pages/WhiteboardEditor'
import { Calendar } from './pages/Calendar'
import { Settings } from './pages/Settings'
import Sidebar from '@renderer/components/Sidebar'
import { AiStreamProvider } from './context/AiStreamContext'
import { SetupWizard } from './components/SetupWizard'

export type SidebarState = 'expanded' | 'collapsed' | 'hidden'

// ── Routes animées ─────────────────────────────────────────────────────────────
function AnimatedRoutes({ sidebar, onSidebarChange }: {
  sidebar: SidebarState
  onSidebarChange: (s: SidebarState) => void
}): React.JSX.Element {
  const location = useLocation()
  return (
    <main className="flex-1 overflow-auto relative min-w-0">
      {sidebar === 'hidden' && (
        <button
          onClick={() => onSidebarChange('expanded')}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-8 h-16 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-r-xl text-slate-400 hover:text-white transition-all shadow-lg"
          title="Ouvrir le menu"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}
      <div key={location.pathname} className="animate-page h-full">
        <Routes location={location}>
          <Route path="/"           element={<Home />} />
          <Route path="/files"      element={<Files />} />
          <Route path="/notes"      element={<Notes />} />
          <Route path="/canvas"     element={<WhiteboardList />} />
          <Route path="/canvas/:id" element={<WhiteboardEditor />} />
          <Route path="/ai"         element={<AI />} />
          <Route path="/calendar"   element={<Calendar />} />
          <Route path="/settings"   element={<Settings />} />
        </Routes>
      </div>
    </main>
  )
}

function App(): React.JSX.Element {
  const [setupDone, setSetupDone] = useState<boolean | null>(null)

  // Applique le thème + préférences d'animation au démarrage
  useEffect(() => {
    window.api.settings.get().then(s => {
      const theme = COLOR_THEMES.find(t => t.label === s.appearance.theme) ?? COLOR_THEMES[0]
      applyTheme(theme)
      document.body.classList.toggle('no-animations', !s.appearance.animations)
    })
    // Vérifier si le wizard a déjà été complété
    setSetupDone(localStorage.getItem('dailyos:setup-done') === 'true')
  }, [])

  const [sidebar, setSidebar] = useState<SidebarState>(() => {
    const saved = localStorage.getItem('dailyos:sidebar')
    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') return saved
    return 'expanded'
  })

  const handleSidebarChange = (state: SidebarState): void => {
    setSidebar(state)
    localStorage.setItem('dailyos:sidebar', state)
  }

  // Pas encore déterminé si setup est fait
  if (setupDone === null) return <div className="bg-slate-950 w-screen h-screen" />

  return (
    <AiStreamProvider>
      <HashRouter>
        {/* Wizard premier lancement */}
        {!setupDone && (
          <SetupWizard onComplete={() => setSetupDone(true)} />
        )}

        <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
          <Sidebar state={sidebar} onChange={handleSidebarChange} />
          <AnimatedRoutes sidebar={sidebar} onSidebarChange={handleSidebarChange} />
        </div>
      </HashRouter>
    </AiStreamProvider>
  )
}

export default App
