import { NavLink } from 'react-router-dom'
import {
  Home, FolderOpen, Calendar, NotebookPen, PenLine, Settings,
  PanelLeftClose, PanelLeftOpen, Sparkles, EyeOff
} from 'lucide-react'
import type { SidebarState } from '../App'
import { useAiStream } from '../context/AiStreamContext'

type Props = {
  state: SidebarState
  onChange: (state: SidebarState) => void
}

// ── Tooltip pour le mode collapsed ──────────────────────────────────────────
function Tooltip({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
      {label}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-700" />
    </div>
  )
}

// ── Item de navigation ───────────────────────────────────────────────────────
type NavItemProps = {
  to: string
  label: string
  icon: React.ElementType
  end: boolean
  collapsed: boolean
  badge?: boolean
}

function NavItem({ to, label, icon: Icon, end, collapsed, badge }: NavItemProps): React.JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative group flex items-center gap-3 rounded-xl transition-all duration-150 select-none
         ${collapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5 w-full'}
         ${isActive
           ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
           : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
         }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Barre active à gauche (mode expanded) */}
          {isActive && !collapsed && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-primary)] rounded-full" />
          )}
          {/* Point actif (mode collapsed) */}
          {isActive && collapsed && (
            <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-[var(--color-primary)] rounded-full" />
          )}

          <div className="relative shrink-0">
            <Icon className={`transition-transform duration-150 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-[var(--color-primary)]' : ''}`} />
            {/* Badge notification IA */}
            {badge && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse" />
            )}
          </div>

          {!collapsed && (
            <span className="text-sm font-medium truncate">{label}</span>
          )}
          {!collapsed && badge && (
            <span className="ml-auto text-[10px] font-semibold bg-[var(--color-primary)]/20 text-[var(--color-primary)] px-1.5 py-0.5 rounded-full">
              Nouveau
            </span>
          )}

          {/* Tooltip en mode collapsed */}
          {collapsed && <Tooltip label={label} />}
        </>
      )}
    </NavLink>
  )
}

// ── Sidebar principale ───────────────────────────────────────────────────────
export default function Sidebar({ state, onChange }: Props): React.JSX.Element {
  const collapsed = state === 'collapsed'
  const hidden    = state === 'hidden'
  const { hasNotification } = useAiStream()

  const NAV_ITEMS = [
    { to: '/',         label: 'Accueil',    icon: Home,        end: true,  badge: false },
    { to: '/ai',       label: 'Assistant',  icon: Sparkles,    end: false, badge: hasNotification },
    { to: '/files',    label: 'Fichiers',   icon: FolderOpen,  end: false, badge: false },
    { to: '/calendar', label: 'Calendrier', icon: Calendar,    end: false, badge: false },
    { to: '/notes',    label: 'Notes',      icon: NotebookPen, end: false, badge: false },
    { to: '/canvas',   label: 'Canvas',     icon: PenLine,     end: false, badge: false },
  ]

  const BOTTOM_ITEMS = [
    { to: '/settings', label: 'Paramètres', icon: Settings, end: false, badge: false },
  ]

  const widthClass = hidden
    ? 'w-0 opacity-0 pointer-events-none'
    : collapsed
      ? 'w-[68px]'
      : 'w-[220px]'

  return (
    <aside
      className={`
        relative flex flex-col h-screen shrink-0 overflow-hidden
        bg-slate-900 border-r border-slate-700/60
        transition-all duration-300 ease-in-out
        ${widthClass}
      `}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center h-14 shrink-0 border-b border-slate-700/60 px-3 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-100 truncate">DailyOS</span>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-accent-gradient flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => onChange('collapsed')}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            title="Réduire"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Navigation principale ────────────────────────────────────────── */}
      <nav className={`flex-1 flex flex-col gap-1 py-4 ${collapsed ? 'px-2 items-center' : 'px-3'} overflow-hidden`}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className={`shrink-0 flex flex-col gap-1 pb-3 border-t border-slate-700/60 pt-3 ${collapsed ? 'px-2 items-center' : 'px-3'}`}>
        {BOTTOM_ITEMS.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        <div className="h-px bg-slate-700/60 my-1" />

        {collapsed ? (
          <button
            onClick={() => onChange('expanded')}
            className="group relative w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
            title="Étendre"
          >
            <PanelLeftOpen className="w-5 h-5" />
            <Tooltip label="Étendre la sidebar" />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChange('hidden')}
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors text-xs"
              title="Masquer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Masquer</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
