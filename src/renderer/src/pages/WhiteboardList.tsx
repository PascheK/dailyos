import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MoreHorizontal, Layout, Trash2, Pencil } from 'lucide-react'
import { useWhiteboard } from '../hooks/useWhiteboard'
import type { AppBoard } from '../types/whiteboard'

const COLORS = [
  '#6d5fff',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#f97316'
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ── Modal de création ────────────────────────────────────────────────────────

type CreateModalProps = {
  onCreate: (title: string, color: string) => Promise<void>
  onClose: () => void
}

function CreateModal({ onCreate, onClose }: CreateModalProps): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    await onCreate(title.trim(), color)
    setLoading(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="h-1.5 w-full transition-colors" style={{ backgroundColor: color }} />
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <h2 className="text-lg font-semibold text-white">Nouvelle note</h2>

          <input
            type="text"
            placeholder="Nom du tableau..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
          />

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Couleur</span>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-40"
              style={{ backgroundColor: color }}
            >
              {loading ? '...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Carte board ──────────────────────────────────────────────────────────────

type BoardCardProps = {
  board: AppBoard
  onOpen: () => void
  onDelete: () => void
}

function BoardCard({ board, onOpen, onDelete }: BoardCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onClick={onOpen}
      className="h-48 bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden hover:border-slate-600 transition-all cursor-pointer group flex flex-col"
    >
      {/* Zone preview */}
      <div className="flex-1 relative" style={{ backgroundColor: board.color + '18' }}>
        <div className="h-0.5 w-full" style={{ backgroundColor: board.color }} />
        <div className="absolute inset-0 flex items-center justify-center opacity-15 mt-1">
          <Layout className="w-16 h-16" style={{ color: board.color }} />
        </div>

        {/* Menu ⋯ */}
        <div
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-10">
              <button
                onClick={() => {
                  onOpen()
                  setMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Ouvrir
              </button>
              <div className="h-px bg-slate-700 my-1" />
              <button
                onClick={() => {
                  onDelete()
                  setMenuOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/50">
        <p className="text-sm font-medium text-slate-100 truncate">{board.title}</p>
        <p className="text-xs text-slate-500 mt-0.5">Modifié le {formatDate(board.updated_at)}</p>
      </div>
    </div>
  )
}

// ── Page liste ───────────────────────────────────────────────────────────────

export function WhiteboardList(): React.JSX.Element {
  const navigate = useNavigate()
  const { boards, loadBoards, createBoard, deleteBoard } = useWhiteboard()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadBoards()
  }, [loadBoards])

  const handleCreate = async (title: string, color: string): Promise<void> => {
    const board = await createBoard(title, color)
    navigate(`/canvas/${board.id}`)
  }

  return (
    <div className="p-8 flex flex-col gap-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {boards.length} note{boards.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-gradient hover:opacity-90 rounded-xl text-sm font-medium text-white transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nouvelle note
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Carte "+" */}
        <button
          onClick={() => setShowCreate(true)}
          className="h-48 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 flex flex-col items-center justify-center gap-3 text-slate-600 hover:text-blue-400 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium">Nouvelle note</span>
        </button>

        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            onOpen={() => navigate(`/canvas/${board.id}`)}
            onDelete={() => deleteBoard(board.id)}
          />
        ))}
      </div>

      {showCreate && <CreateModal onCreate={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  )
}
