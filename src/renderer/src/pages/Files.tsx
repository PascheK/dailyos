import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Upload, Search, List, FileText, Image, Film, Music, File, Code,
  FolderPlus, FilePlus, ExternalLink, Trash2, FolderInput, X, ChevronRight,
  Home, Check, HardDrive, ChevronUp, ChevronDown, FolderOpen, Pencil,
  GripVertical
} from 'lucide-react'
import { useFiles } from '../hooks/useFiles'
import type { AppFile, AppFolder } from '../types/files'
import { FilePreview } from '../components/files/FilePreview'

// ── Utilitaires ───────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

type FileCategory = 'img' | 'video' | 'audio' | 'pdf' | 'code' | 'doc' | 'other'

function getCategory(mime: string): FileCategory {
  if (mime.startsWith('image/'))  return 'img'
  if (mime.startsWith('video/'))  return 'video'
  if (mime.startsWith('audio/'))  return 'audio'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('text/') || mime.includes('javascript') || mime.includes('typescript') ||
      mime.includes('json') || mime.includes('html') || mime.includes('css')) return 'code'
  if (mime.includes('word') || mime === 'text/plain' || mime === 'text/markdown') return 'doc'
  return 'other'
}

function mimeLabel(mime: string): string {
  return { img: 'Image', video: 'Vidéo', audio: 'Audio', pdf: 'PDF',
           code: 'Code', doc: 'Document', other: 'Fichier' }[getCategory(mime)] ?? 'Fichier'
}

// ── Couleurs de dossiers ──────────────────────────────────────────────────────

const FOLDER_COLORS: { value: string | null; label: string }[] = [
  { value: null,      label: 'Par défaut' },
  { value: '#3b82f6', label: 'Bleu'    },
  { value: '#8b5cf6', label: 'Violet'  },
  { value: '#22c55e', label: 'Vert'    },
  { value: '#eab308', label: 'Jaune'   },
  { value: '#f97316', label: 'Orange'  },
  { value: '#ef4444', label: 'Rouge'   },
  { value: '#ec4899', label: 'Rose'    },
  { value: '#06b6d4', label: 'Cyan'    },
]

// ── Icônes de fichiers ────────────────────────────────────────────────────────

const CAT_STYLE: Record<FileCategory, { bg: string; color: string; icon: (cls: string) => React.JSX.Element }> = {
  pdf:   { bg: 'bg-red-500/20',    color: 'text-red-400',    icon: (c) => <FileText className={c} /> },
  doc:   { bg: 'bg-blue-500/20',   color: 'text-blue-400',   icon: (c) => <FileText className={c} /> },
  img:   { bg: 'bg-emerald-500/20',color: 'text-emerald-400',icon: (c) => <Image    className={c} /> },
  video: { bg: 'bg-purple-500/20', color: 'text-purple-400', icon: (c) => <Film     className={c} /> },
  audio: { bg: 'bg-pink-500/20',   color: 'text-pink-400',   icon: (c) => <Music    className={c} /> },
  code:  { bg: 'bg-amber-500/20',  color: 'text-amber-400',  icon: (c) => <Code     className={c} /> },
  other: { bg: 'bg-slate-700',     color: 'text-slate-400',  icon: (c) => <File     className={c} /> },
}

function FileIcon({ mime, size = 'md' }: { mime: string; size?: 'sm' | 'md' | 'lg' | 'xl' }): React.JSX.Element {
  const cat = getCategory(mime)
  const { bg, color, icon } = CAT_STYLE[cat]
  const box = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-16 h-16' }[size]
  const icn = { sm: 'w-4 h-4', md: 'w-5 h-5',   lg: 'w-7 h-7',   xl: 'w-8 h-8'  }[size]
  return (
    <div className={`${box} rounded-2xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
      {icon(icn)}
    </div>
  )
}

// ── Icône dossier ─────────────────────────────────────────────────────────────

function FolderIcon({ size = 'xl', isEmpty = false, highlight = false, color }: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isEmpty?: boolean
  highlight?: boolean
  color?: string | null
}): React.JSX.Element {
  const dim = { sm: 32, md: 40, lg: 56, xl: 64 }[size]
  const resolvedColor = highlight
    ? 'var(--color-primary)'
    : (color ?? (isEmpty ? '#475569' : 'var(--color-primary)'))

  return (
    <svg width={dim} height={dim} viewBox="0 0 64 64" fill="none"
      className="shrink-0 transition-colors"
      style={{ color: resolvedColor }}
    >
      <rect x="2" y="18" width="60" height="40" rx="6" fill="currentColor" opacity={highlight ? 1 : 0.85} />
      <path d="M2 22 C2 18, 4 16, 8 16 L26 16 C28 16, 30 17, 31 19 L33 22 Z" fill="currentColor" opacity={highlight ? 1 : 0.7} />
      <rect x="8" y="28" width="32" height="4" rx="2" fill="white" opacity="0.15" />
    </svg>
  )
}

// ── Helpers menus contextuels ─────────────────────────────────────────────────

function useMenuDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void): void {
  useEffect(() => {
    const down = (e: MouseEvent)    => { if (!ref.current?.contains(e.target as Node)) onClose() }
    const key  = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown',   key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [ref, onClose])
}

function menuPos(x: number, y: number, w: number, h: number): { left: number; top: number } {
  return {
    left: x + w > window.innerWidth  ? x - w : x,
    top:  y + h > window.innerHeight ? y - h : y,
  }
}

// Portal — rend les menus au niveau du body pour éviter tout décalage dû aux
// ancêtres avec backdrop-filter ou transform (qui créent un containing-block).
function Portal({ children }: { children: React.ReactNode }): React.JSX.Element {
  return createPortal(children, document.body)
}

const menuCls = 'fixed z-[200] bg-[#1c1f27]/97 backdrop-blur-2xl border border-white/[0.07] rounded-xl shadow-2xl shadow-black/80 p-1 overflow-hidden'
const rowCls  = 'w-full flex items-center gap-2.5 px-3 py-[6px] text-[13px] rounded-lg hover:bg-white/[0.07] transition-colors text-left'

// ── Menu contextuel — fond canvas ─────────────────────────────────────────────

function CanvasContextMenu({ x, y, view, showNewFolder, onClose, onNewFolder, onNewNote, onImport, onToggleView }: {
  x: number; y: number; view: 'desktop' | 'list'; showNewFolder: boolean
  onClose: () => void; onNewFolder: () => void; onNewNote: () => void
  onImport: () => void; onToggleView: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useMenuDismiss(ref, onClose)
  const { left, top } = menuPos(x, y, 200, showNewFolder ? 140 : 110)

  return (
    <div ref={ref} style={{ left, top }} className={`${menuCls} w-48`} onContextMenu={(e) => e.preventDefault()}>
      {showNewFolder && (
        <button onClick={() => { onNewFolder(); onClose() }} className={`${rowCls} text-slate-200`}>
          <FolderPlus className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Nouveau dossier
        </button>
      )}
      <button onClick={() => { onNewNote(); onClose() }} className={`${rowCls} text-slate-200`}>
        <FilePlus className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Nouvelle note .md
      </button>
      <button onClick={() => { onImport(); onClose() }} className={`${rowCls} text-slate-200`}>
        <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Importer…
      </button>
      <div className="h-px bg-white/[0.06] my-1 mx-1" />
      <button onClick={() => { onToggleView(); onClose() }} className={`${rowCls} text-slate-400`}>
        <List className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {view === 'desktop' ? 'Vue liste' : 'Vue bureau'}
      </button>
    </div>
  )
}

// ── Menu contextuel — fichier ─────────────────────────────────────────────────

function FileContextMenu({ x, y, file, selectionCount, onClose, onOpen, onReveal, onRename, onMoveRequest, onDelete }: {
  x: number; y: number; file: AppFile; selectionCount: number
  onClose: () => void; onOpen: () => void; onReveal: () => void
  onRename: () => void; onMoveRequest: () => void; onDelete: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useMenuDismiss(ref, onClose)
  const isNote = file.mime_type === 'text/markdown'
  const multi  = selectionCount > 1
  const h = 155 + (isNote && !multi ? 28 : 0)
  const { left, top } = menuPos(x, y, 190, h)

  return (
    <div ref={ref} style={{ left, top }} className={`${menuCls} w-48`} onContextMenu={(e) => e.preventDefault()}>
      {!multi && (
        <>
          <button onClick={() => { onOpen(); onClose() }} className={`${rowCls} text-slate-200`}>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Ouvrir
          </button>
          <button onClick={() => { onReveal(); onClose() }} className={`${rowCls} text-slate-200`}>
            <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Révéler dans Finder
          </button>
          <div className="h-px bg-white/[0.06] my-1 mx-1" />
          {isNote && (
            <button onClick={() => { onRename(); onClose() }} className={`${rowCls} text-slate-200`}>
              <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Renommer
            </button>
          )}
        </>
      )}
      <button onClick={() => { onMoveRequest(); onClose() }} className={`${rowCls} text-slate-200`}>
        <FolderInput className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        {multi ? `Déplacer ${selectionCount} fichiers…` : 'Déplacer vers…'}
      </button>
      <div className="h-px bg-white/[0.06] my-1 mx-1" />
      <button onClick={() => { onDelete(); onClose() }} className={`${rowCls} text-red-400`}>
        <Trash2 className="w-3.5 h-3.5 shrink-0" />
        {multi ? `Supprimer ${selectionCount} fichiers` : 'Supprimer'}
      </button>
    </div>
  )
}

// ── Menu contextuel — dossier ─────────────────────────────────────────────────

function FolderContextMenu({ x, y, folder, onClose, onOpen, onRename, onSetColor, onDelete }: {
  x: number; y: number; folder: AppFolder
  onClose: () => void; onOpen: () => void
  onRename: () => void; onSetColor: (c: string | null) => void; onDelete: () => void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useMenuDismiss(ref, onClose)
  const { left, top } = menuPos(x, y, 190, 190)

  return (
    <div ref={ref} style={{ left, top }} className={`${menuCls} w-48`} onContextMenu={(e) => e.preventDefault()}>
      <button onClick={() => { onOpen(); onClose() }} className={`${rowCls} text-slate-200`}>
        <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Ouvrir
      </button>
      <div className="h-px bg-white/[0.06] my-1 mx-1" />
      <button onClick={() => { onRename(); onClose() }} className={`${rowCls} text-slate-200`}>
        <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" /> Renommer
      </button>

      {/* Palette de couleurs */}
      <div className="px-3 py-2">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-1.5">Couleur</p>
        <div className="flex items-center gap-1 flex-wrap">
          {FOLDER_COLORS.map(({ value, label }) => (
            <button
              key={value ?? 'default'}
              title={label}
              onClick={() => { onSetColor(value); onClose() }}
              className="relative w-4 h-4 rounded-full transition-transform hover:scale-125 focus:outline-none"
              style={{ backgroundColor: value ?? '#475569' }}
            >
              {folder.color === value && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white drop-shadow" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/[0.06] my-1 mx-1" />
      <button onClick={() => { onDelete(); onClose() }} className={`${rowCls} text-red-400`}>
        <Trash2 className="w-3.5 h-3.5 shrink-0" /> Supprimer
      </button>
    </div>
  )
}

// ── Modal "Déplacer vers" ─────────────────────────────────────────────────────

function MoveSheet({ files, folders, onMove, onClose }: {
  files: AppFile[]; folders: AppFolder[]
  onMove: (folderId: number | null) => void
  onClose: () => void
}): React.JSX.Element {
  const multi       = files.length > 1
  const singleFile  = files[0]
  const commonFolderIds = new Set(files.map((f) => f.folder_id))
  const isInFolder  = !multi && singleFile.folder_id !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#1c1f27] border border-white/[0.08] rounded-2xl shadow-2xl w-72 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <p className="text-sm font-semibold text-white">
            {multi ? `Déplacer ${files.length} fichiers` : 'Déplacer vers…'}
          </p>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="py-1 max-h-72 overflow-auto">
          {isInFolder && (
            <button
              onClick={() => { onMove(null); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition-colors"
            >
              <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="flex-1 text-left italic">Retirer du dossier</span>
            </button>
          )}
          {folders
            .filter((f) => multi ? true : f.id !== singleFile.folder_id)
            .map((f) => (
              <button
                key={f.id}
                onClick={() => { onMove(f.id); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5 transition-colors"
              >
                <FolderIcon size="sm" color={f.color} />
                <span className="flex-1 text-left truncate">{f.name}</span>
                {!multi && singleFile.folder_id === f.id && (
                  <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                )}
                {multi && commonFolderIds.size === 1 && singleFile.folder_id === f.id && (
                  <Check className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                )}
              </button>
            ))
          }
          {folders.length === 0 && (
            <p className="px-4 py-5 text-xs text-slate-500 text-center">Aucun dossier disponible.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Quick Look (Espace) ───────────────────────────────────────────────────────

function QuickLookModal({ file, onClose, onOpen, onReveal }: {
  file: AppFile; onClose: () => void
  onOpen: (path: string) => void; onReveal: (path: string) => void
}): React.JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}
    >
      <div
        className="w-[78vw] max-w-4xl h-[82vh] flex flex-col bg-[#1c1f27] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] shrink-0">
          <FileIcon mime={file.mime_type} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{mimeLabel(file.mime_type)} · {formatSize(file.size)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onOpen(file.path)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/8 rounded-lg transition-colors"
              title="Ouvrir"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReveal(file.path)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/8 rounded-lg transition-colors"
              title="Révéler dans Finder"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/8 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Contenu */}
        <div className="flex-1 overflow-hidden">
          <FilePreview file={file} onClose={onClose} onOpen={onOpen} onReveal={onReveal} />
        </div>
        <div className="flex items-center justify-center py-2 border-t border-white/[0.05]">
          <p className="text-[10px] text-slate-700">Espace ou Échap pour fermer</p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Champ renommage inline (vue liste) ────────────────────────────────────────

function InlineRename({ value, isNote = false, onConfirm, onCancel }: {
  value: string; isNote?: boolean
  onConfirm: (v: string) => void; onCancel: () => void
}): React.JSX.Element {
  const displayValue = isNote ? value.replace(/\.md$/, '') : value
  const [draft, setDraft] = useState(displayValue)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  const confirm = () => {
    const t = draft.trim()
    if (t && t !== displayValue) onConfirm(t)
    else onCancel()
  }

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') confirm()
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={confirm}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 bg-slate-950 border border-[var(--color-primary)]/50 rounded-md px-2 py-0.5 text-sm text-white focus:outline-none focus:border-[var(--color-primary)] min-w-0 transition-colors"
    />
  )
}

// ── Icône de bureau (fichier ou dossier) ──────────────────────────────────────

function DesktopItem({
  label, selected, isDragOver, draggable: isDraggable = false, isRenaming = false, isNote = false,
  onSelect, onOpen, onContextMenu, onDragStart, onDragEnd,
  onDragOver, onDragLeave, onDrop, onRenameConfirm, onRenameCancel,
  children
}: {
  label: string; selected: boolean; isDragOver?: boolean; draggable?: boolean
  isRenaming?: boolean; isNote?: boolean
  onSelect: (e: React.MouseEvent) => void; onOpen: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onDragStart?: () => void; onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void; onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
  onRenameConfirm?: (name: string) => void; onRenameCancel?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const displayLabel = isNote ? label.replace(/\.md$/, '') : label
  const [draft, setDraft] = useState(displayLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraft(displayLabel)
      requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select() })
    }
  }, [isRenaming, displayLabel])

  const confirmRename = () => {
    const t = draft.trim()
    if (t && t !== displayLabel) onRenameConfirm?.(t)
    else onRenameCancel?.()
  }

  return (
    <div
      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-default select-none transition-all w-[88px]
        ${selected && !isRenaming ? 'bg-[var(--color-primary)]/20 ring-1 ring-[var(--color-primary)]/40' : isRenaming ? '' : 'hover:bg-white/5'}
        ${isDragOver ? 'bg-[var(--color-primary)]/25 ring-2 ring-[var(--color-primary)]/60 scale-105' : ''}
      `}
      draggable={isDraggable && !isRenaming}
      onClick={isRenaming ? (e) => e.stopPropagation() : onSelect}
      onDoubleClick={isRenaming ? undefined : (e) => { e.stopPropagation(); onOpen() }}
      onContextMenu={isRenaming ? (e) => e.preventDefault() : onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="transition-transform">{children}</div>
      {isRenaming ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') confirmRename()
            if (e.key === 'Escape') onRenameCancel?.()
          }}
          onBlur={confirmRename}
          onClick={(e) => e.stopPropagation()}
          className="w-full text-center text-[11px] bg-slate-950 border border-[var(--color-primary)]/50 rounded-md px-1.5 py-0.5 text-white focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        />
      ) : (
        <span className={`text-[11px] font-medium text-center leading-tight line-clamp-2 w-full px-0.5 rounded
          ${selected ? 'bg-[var(--color-primary)] text-white px-1' : 'text-slate-300'}`}>
          {displayLabel}
        </span>
      )}
    </div>
  )
}

// ── Dossier dans le dock (avec handle de réorganisation) ─────────────────────

function DockFolder({
  folder, isActive, count, isDragOver, isReorderOver,
  onClick, onDragOver, onDragLeave, onDrop, onContextMenu,
  onReorderStart, onReorderEnd,
}: {
  folder: AppFolder; isActive: boolean; count: number
  isDragOver: boolean; isReorderOver: boolean
  onClick: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onReorderStart: () => void
  onReorderEnd: () => void
}): React.JSX.Element {
  return (
    <div className="relative shrink-0 group/dock">
      {/* Indicateur de drop pour réorganisation */}
      {isReorderOver && (
        <div className="absolute -left-0.5 top-1 bottom-1 w-0.5 bg-[var(--color-primary)] rounded-full" />
      )}

      {/* Handle de réorganisation */}
      <div
        draggable
        onDragStart={(e) => { e.stopPropagation(); onReorderStart() }}
        onDragEnd={onReorderEnd}
        className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/dock:opacity-100
          cursor-grab active:cursor-grabbing p-0.5 z-10 rounded"
        title="Glisser pour réordonner"
      >
        <GripVertical className="w-3 h-3 text-slate-500" />
      </div>

      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
          isDragOver
            ? 'bg-[var(--color-primary)]/30 ring-2 ring-[var(--color-primary)]/50 scale-110'
            : isActive
              ? 'bg-[var(--color-primary)]/15'
              : 'hover:bg-white/[0.07]'
        }`}
      >
        <FolderIcon size="sm" highlight={isActive || isDragOver} color={folder.color} isEmpty={count === 0} />
        <span className={`text-[10px] font-medium max-w-[64px] truncate transition-colors ${
          isActive ? 'text-[var(--color-primary)]' : 'text-slate-400'
        }`}>
          {folder.name}
        </span>
        {count > 0 && (
          <span className="text-[9px] text-slate-600 tabular-nums -mt-0.5">{count}</span>
        )}
      </button>
      {isActive && (
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-primary)]" />
      )}
    </div>
  )
}

// ── En-tête tri (vue liste) ───────────────────────────────────────────────────

type SortKey = 'name' | 'size' | 'date' | 'type'

function SortHeader({ label, sortKey, current, dir, onClick }: {
  label: string; sortKey: SortKey; current: SortKey; dir: 'asc' | 'desc'
  onClick: (k: SortKey) => void
}): React.JSX.Element {
  const active = current === sortKey
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active ? 'text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {label}
      {active && (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export function Files(): React.JSX.Element {
  const [view,          setView]          = useState<'desktop' | 'list'>('desktop')
  const [search,        setSearch]        = useState('')
  const [activeFolder,  setActiveFolder]  = useState<number | undefined>(undefined)
  // Multi-sélection
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set())
  const [focusedFile,   setFocusedFile]   = useState<AppFile | null>(null)
  const [quickLookFile, setQuickLookFile] = useState<AppFile | null>(null)
  const [sortKey,       setSortKey]       = useState<SortKey>('name')
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [ctxMenu,       setCtxMenu]       = useState<{ x: number; y: number; file: AppFile } | null>(null)
  const [folderCtxMenu, setFolderCtxMenu] = useState<{ x: number; y: number; folder: AppFolder } | null>(null)
  const [canvasCtxMenu, setCanvasCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [renamingItem,  setRenamingItem]  = useState<{ id: number; type: 'file' | 'folder' } | null>(null)
  const [moveTarget,    setMoveTarget]    = useState<AppFile[] | null>(null)
  const [draggingFile,  setDraggingFile]  = useState<AppFile | null>(null)
  const [dragOverFolder,setDragOverFolder]= useState<number | 'root' | null>(null)
  // Réorganisation dock
  const [reorderDragId, setReorderDragId] = useState<number | null>(null)
  const [reorderOverId, setReorderOverId] = useState<number | null>(null)

  const {
    files, folders, loadFiles, loadFolders,
    pickAndAdd, openFile, revealFile, moveFile, deleteFile, renameFile, createNote,
    createFolder, deleteFolder, renameFolder, setFolderColor, reorderFolders,
  } = useFiles()

  useEffect(() => { loadFiles(); loadFolders() }, [loadFiles, loadFolders])

  // ── Computed ──────────────────────────────────────────────────────────────

  const countInFolder    = useCallback((id: number) => files.filter((f) => f.folder_id === id).length, [files])
  const activeFolderName = folders.find((f) => f.id === activeFolder)?.name
  const isSearching      = search.trim().length > 0

  // Recherche globale : quand on cherche, on ignore le dossier actif
  const visibleFolders = isSearching ? [] : (activeFolder === undefined ? folders : [])

  const visibleFiles = files
    .filter((f) => {
      const matchSearch = f.name.toLowerCase().includes(search.toLowerCase())
      if (isSearching) return matchSearch
      const inScope = activeFolder === undefined ? f.folder_id === null : f.folder_id === activeFolder
      return inScope && matchSearch
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortKey === 'size') cmp = a.size - b.size
      else if (sortKey === 'date') cmp = a.created_at.localeCompare(b.created_at)
      else if (sortKey === 'type') cmp = getCategory(a.mime_type).localeCompare(getCategory(b.mime_type))
      return sortDir === 'asc' ? cmp : -cmp
    })

  const selectedFileObjects = visibleFiles.filter((f) => selectedIds.has(f.id))

  const handleSort = (key: SortKey): void => {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Drag & Drop (fichiers) ────────────────────────────────────────────────

  const handleFileDragStart = (file: AppFile) => {
    setDraggingFile(file)
    setReorderDragId(null)
  }
  const handleFileDragEnd = () => { setDraggingFile(null); setDragOverFolder(null) }

  const handleFolderDragOver = (e: React.DragEvent, target: number | 'root') => {
    e.preventDefault()
    if (draggingFile) setDragOverFolder(target)
  }

  const handleFolderDrop = async (e: React.DragEvent, folderId: number | null) => {
    e.preventDefault()
    if (draggingFile && draggingFile.folder_id !== folderId) {
      if (selectedIds.has(draggingFile.id) && selectedIds.size > 1) {
        await Promise.all(selectedFileObjects.map((f) => moveFile(f.id, folderId)))
      } else {
        await moveFile(draggingFile.id, folderId)
      }
    }
    setDraggingFile(null)
    setDragOverFolder(null)
  }

  // ── Réorganisation des dossiers (dock) ────────────────────────────────────

  const handleReorderStart = (id: number) => {
    setReorderDragId(id)
    setDraggingFile(null)
  }
  const handleReorderEnd = () => { setReorderDragId(null); setReorderOverId(null) }

  const handleDockDragOver = (e: React.DragEvent, folder: AppFolder) => {
    e.preventDefault()
    if (reorderDragId !== null) setReorderOverId(folder.id)
    else if (draggingFile !== null) setDragOverFolder(folder.id)
  }

  const handleDockDrop = async (e: React.DragEvent, folder: AppFolder) => {
    e.preventDefault()
    if (reorderDragId !== null) {
      const fromIdx = folders.findIndex((f) => f.id === reorderDragId)
      const toIdx   = folders.findIndex((f) => f.id === folder.id)
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        const newOrder = folders.map((f) => f.id)
        const [removed] = newOrder.splice(fromIdx, 1)
        newOrder.splice(toIdx, 0, removed)
        await reorderFolders(newOrder)
      }
      setReorderDragId(null)
      setReorderOverId(null)
    } else {
      await handleFolderDrop(e, folder.id)
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = (folderId: number | undefined) => {
    setActiveFolder(folderId)
    setSelectedIds(new Set())
    setFocusedFile(null)
    setSearch('')
    setRenamingItem(null)
  }

  // ── Création ─────────────────────────────────────────────────────────────

  const handleNewFolder = async () => {
    if (activeFolder !== undefined) navigateTo(undefined)
    const folder = await createFolder('Sans titre')
    setRenamingItem({ id: folder.id, type: 'folder' })
  }

  const handleNewNote = async () => {
    const file = await createNote('note', activeFolder)
    setRenamingItem({ id: file.id, type: 'file' })
  }

  const handleDeleteFolder = async (id: number) => {
    await deleteFolder(id)
    if (activeFolder === id) navigateTo(undefined)
  }

  // ── Renommage inline ──────────────────────────────────────────────────────

  const handleRenameConfirm = async (id: number, type: 'file' | 'folder', name: string) => {
    if (type === 'folder') await renameFolder(id, name)
    else await renameFile(id, name)
    setRenamingItem(null)
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  const handleBulkDelete = async () => {
    await Promise.all(selectedFileObjects.map((f) => deleteFile(f.id)))
    setSelectedIds(new Set())
    setFocusedFile(null)
  }

  const handleBulkMove = (folderId: number | null) => {
    void Promise.all(selectedFileObjects.map((f) => moveFile(f.id, folderId)))
    setSelectedIds(new Set())
    setMoveTarget(null)
  }

  // ── Menus & sélection ────────────────────────────────────────────────────

  const closeAllMenus = () => {
    setCtxMenu(null)
    setFolderCtxMenu(null)
    setCanvasCtxMenu(null)
  }

  const handleAreaClick = () => { setSelectedIds(new Set()); setFocusedFile(null); closeAllMenus() }

  const handleFileClick = (e: React.MouseEvent, file: AppFile) => {
    e.stopPropagation()
    closeAllMenus()

    if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(file.id)) next.delete(file.id)
        else next.add(file.id)
        return next
      })
      setFocusedFile(file)
    } else if (e.shiftKey && focusedFile) {
      const fromIdx = visibleFiles.findIndex((f) => f.id === focusedFile.id)
      const toIdx   = visibleFiles.findIndex((f) => f.id === file.id)
      const [lo, hi] = [Math.min(fromIdx, toIdx), Math.max(fromIdx, toIdx)]
      setSelectedIds(new Set(visibleFiles.slice(lo, hi + 1).map((f) => f.id)))
      setFocusedFile(file)
    } else {
      if (selectedIds.size === 1 && selectedIds.has(file.id)) {
        setSelectedIds(new Set())
        setFocusedFile(null)
      } else {
        setSelectedIds(new Set([file.id]))
        setFocusedFile(file)
      }
    }
  }

  const handleFileCtxMenu = (e: React.MouseEvent, file: AppFile) => {
    e.preventDefault(); e.stopPropagation()
    closeAllMenus()
    if (!selectedIds.has(file.id)) {
      setSelectedIds(new Set([file.id]))
      setFocusedFile(file)
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, file })
  }

  const handleFolderCtxMenu = (e: React.MouseEvent, folder: AppFolder) => {
    e.preventDefault(); e.stopPropagation()
    closeAllMenus()
    setFolderCtxMenu({ x: e.clientX, y: e.clientY, folder })
  }

  const handleCanvasCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    closeAllMenus()
    setCanvasCtxMenu({ x: e.clientX, y: e.clientY })
  }

  // Raccourcis clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set()); setFocusedFile(null)
        closeAllMenus(); setRenamingItem(null); setQuickLookFile(null)
      }
      if (e.key === ' ' && focusedFile && !renamingItem && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        setQuickLookFile((prev) => prev ? null : focusedFile)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && e.metaKey && !renamingItem) {
        void handleBulkDelete()
      }
      if (e.key === 'Enter' && focusedFile && selectedIds.size === 1 && !renamingItem) {
        void openFile(focusedFile.path)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedFile, selectedIds, renamingItem, deleteFile, openFile])

  // ── Rendu ─────────────────────────────────────────────────────────────────

  const totalVisibleSize = visibleFiles.reduce((s, f) => s + f.size, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950/50" onClick={handleAreaClick}>

      {/* ════ TOOLBAR ════ */}
      <div className="flex items-center gap-2.5 px-4 py-2 border-b border-white/[0.05] bg-slate-900/60 shrink-0">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={(e) => { e.stopPropagation(); navigateTo(undefined) }}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
              activeFolder === undefined && !isSearching ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          {activeFolderName && !isSearching && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="px-2 py-1 text-white font-medium text-sm">{activeFolderName}</span>
            </>
          )}
          {isSearching && (
            <span className="px-2 py-0.5 text-[11px] bg-[var(--color-primary)]/15 text-[var(--color-primary)] rounded-full font-medium">
              Recherche globale
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Recherche */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text" placeholder="Rechercher partout…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-slate-800/80 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Vue toggle */}
        <div className="flex items-center gap-0.5 bg-slate-800/80 rounded-lg p-0.5 border border-white/[0.08]" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setView('desktop')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'desktop' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            Bureau
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${view === 'list' ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-white'}`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Import */}
        <button
          onClick={(e) => { e.stopPropagation(); void pickAndAdd(activeFolder) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-sm font-medium text-white transition-all"
        >
          <Upload className="w-3.5 h-3.5" /> Importer
        </button>
      </div>

      {/* ════ ZONE PRINCIPALE ════ */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* ── Vue bureau ── */}
          {view === 'desktop' && (
            <div
              className="flex-1 overflow-auto p-4"
              onClick={handleAreaClick}
              onContextMenu={handleCanvasCtxMenu}
              onDragOver={(e) => { if (activeFolder !== undefined && draggingFile) { e.preventDefault(); setDragOverFolder('root') } }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={(e) => { if (activeFolder !== undefined) void handleFolderDrop(e, null) }}
            >
              {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 flex items-center justify-center opacity-20">
                    <FolderIcon size="xl" isEmpty />
                  </div>
                  <p className="text-sm text-slate-600">
                    {isSearching
                      ? `Aucun résultat pour « ${search} »`
                      : activeFolder !== undefined
                        ? 'Ce dossier est vide'
                        : 'Clic droit pour créer un dossier ou importer'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 content-start" style={{ minHeight: '100%' }}>

                  {/* Dossiers */}
                  {visibleFolders.map((folder) => {
                    const isDragTarget = dragOverFolder === folder.id
                    const isRen = renamingItem?.id === folder.id && renamingItem?.type === 'folder'
                    return (
                      <DesktopItem
                        key={`folder-${folder.id}`}
                        label={folder.name}
                        selected={false}
                        isDragOver={isDragTarget}
                        isRenaming={isRen}
                        onSelect={(e) => e.stopPropagation()}
                        onOpen={() => navigateTo(folder.id)}
                        onContextMenu={(e) => handleFolderCtxMenu(e, folder)}
                        onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                        onDragLeave={() => setDragOverFolder(null)}
                        onDrop={(e) => void handleFolderDrop(e, folder.id)}
                        onRenameConfirm={(name) => void handleRenameConfirm(folder.id, 'folder', name)}
                        onRenameCancel={() => setRenamingItem(null)}
                      >
                        <div className="relative">
                          <FolderIcon size="xl" highlight={isDragTarget} color={folder.color} isEmpty={countInFolder(folder.id) === 0} />
                          {countInFolder(folder.id) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                              {countInFolder(folder.id)}
                            </span>
                          )}
                        </div>
                      </DesktopItem>
                    )
                  })}

                  {visibleFolders.length > 0 && visibleFiles.length > 0 && (
                    <div className="w-full h-px bg-white/[0.04] my-2" />
                  )}

                  {/* Fichiers */}
                  {visibleFiles.map((file) => {
                    const isSelected = selectedIds.has(file.id)
                    const isRen  = renamingItem?.id === file.id && renamingItem?.type === 'file'
                    const isNote = file.mime_type === 'text/markdown'
                    return (
                      <DesktopItem
                        key={`file-${file.id}`}
                        label={file.name}
                        selected={isSelected}
                        draggable
                        isRenaming={isRen}
                        isNote={isNote}
                        onSelect={(e) => handleFileClick(e, file)}
                        onOpen={() => void openFile(file.path)}
                        onContextMenu={(e) => handleFileCtxMenu(e, file)}
                        onDragStart={() => handleFileDragStart(file)}
                        onDragEnd={handleFileDragEnd}
                        onRenameConfirm={(name) => void handleRenameConfirm(file.id, 'file', name)}
                        onRenameCancel={() => setRenamingItem(null)}
                      >
                        {/* Badge dossier en recherche globale */}
                        <div className="relative">
                          <FileIcon mime={file.mime_type} size="xl" />
                          {isSearching && file.folder_id !== null && (
                            <span className="absolute -bottom-1 -right-1 bg-slate-800 border border-slate-700 rounded-md px-1 text-[9px] text-slate-400 max-w-[52px] truncate">
                              {file.folder ?? ''}
                            </span>
                          )}
                        </div>
                      </DesktopItem>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Vue liste ── */}
          {view === 'list' && (
            <div className="flex-1 overflow-auto" onClick={handleAreaClick} onContextMenu={handleCanvasCtxMenu}>
              <div className="sticky top-0 grid grid-cols-[auto_1fr_100px_80px_100px] gap-3 px-4 py-2 bg-slate-900/90 backdrop-blur border-b border-white/[0.05] z-10">
                <div className="w-10" />
                <SortHeader label="Nom"    sortKey="name" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Type"   sortKey="type" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Taille" sortKey="size" current={sortKey} dir={sortDir} onClick={handleSort} />
                <SortHeader label="Date"   sortKey="date" current={sortKey} dir={sortDir} onClick={handleSort} />
              </div>
              <div className="px-2 py-1">
                {/* Dossiers */}
                {visibleFolders.map((folder) => {
                  const isRen = renamingItem?.id === folder.id && renamingItem?.type === 'folder'
                  return (
                    <div
                      key={`fl-${folder.id}`}
                      onDoubleClick={() => !isRen && navigateTo(folder.id)}
                      onContextMenu={(e) => handleFolderCtxMenu(e, folder)}
                      onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                      onDragLeave={() => setDragOverFolder(null)}
                      onDrop={(e) => void handleFolderDrop(e, folder.id)}
                      className={`grid grid-cols-[auto_1fr_100px_80px_100px] gap-3 items-center px-2 py-2 rounded-lg cursor-default transition-colors ${
                        dragOverFolder === folder.id
                          ? 'bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/40'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center">
                        <FolderIcon size="sm" color={folder.color} />
                      </div>
                      {isRen ? (
                        <InlineRename
                          value={folder.name}
                          onConfirm={(name) => void handleRenameConfirm(folder.id, 'folder', name)}
                          onCancel={() => setRenamingItem(null)}
                        />
                      ) : (
                        <span className="text-sm font-medium text-slate-200 truncate">{folder.name}</span>
                      )}
                      <span className="text-xs text-slate-600">Dossier</span>
                      <span className="text-xs text-slate-600 tabular-nums">{countInFolder(folder.id)} élém.</span>
                      <span className="text-xs text-slate-600 tabular-nums">{formatDate(folder.created_at)}</span>
                    </div>
                  )
                })}

                {/* Fichiers */}
                {visibleFiles.map((file) => {
                  const isSelected = selectedIds.has(file.id)
                  const isRen  = renamingItem?.id === file.id && renamingItem?.type === 'file'
                  const isNote = file.mime_type === 'text/markdown'
                  return (
                    <div
                      key={`file-${file.id}`}
                      draggable={!isRen}
                      onClick={(e) => { if (!isRen) handleFileClick(e, file) }}
                      onDoubleClick={(e) => { if (!isRen) { e.stopPropagation(); void openFile(file.path) } }}
                      onContextMenu={(e) => handleFileCtxMenu(e, file)}
                      onDragStart={() => handleFileDragStart(file)}
                      onDragEnd={handleFileDragEnd}
                      className={`grid grid-cols-[auto_1fr_100px_80px_100px] gap-3 items-center px-2 py-2 rounded-lg cursor-default select-none transition-colors ${
                        isSelected && !isRen
                          ? 'bg-[var(--color-primary)]/15 ring-1 ring-[var(--color-primary)]/30'
                          : 'hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <FileIcon mime={file.mime_type} size="sm" />
                      {isRen ? (
                        <InlineRename
                          value={file.name}
                          isNote={isNote}
                          onConfirm={(name) => void handleRenameConfirm(file.id, 'file', name)}
                          onCancel={() => setRenamingItem(null)}
                        />
                      ) : (
                        <div className="min-w-0">
                          <span className={`text-sm font-medium truncate block ${isSelected ? 'text-[var(--color-primary)]' : 'text-white'}`}>
                            {isNote ? file.name.replace(/\.md$/, '') : file.name}
                          </span>
                          {isSearching && file.folder_id !== null && (
                            <span className="text-[10px] text-slate-600 truncate block">{file.folder}</span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-slate-600">{mimeLabel(file.mime_type)}</span>
                      <span className="text-xs text-slate-600 tabular-nums">{formatSize(file.size)}</span>
                      <span className="text-xs text-slate-600 tabular-nums">{formatDate(file.created_at)}</span>
                    </div>
                  )
                })}

                {visibleFolders.length === 0 && visibleFiles.length === 0 && (
                  <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
                    {isSearching ? `Aucun résultat pour « ${search} »` : 'Clic droit pour créer un dossier ou importer'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Barre de statut ── */}
          <div className="h-7 flex items-center px-4 gap-2 border-t border-white/[0.05] bg-slate-900/40 shrink-0">
            {selectedIds.size > 1 ? (
              /* Mode multi-sélection */
              <>
                <span className="text-[11px] font-medium text-[var(--color-primary)]">
                  {selectedIds.size} fichiers sélectionnés
                </span>
                <div className="h-3 w-px bg-white/10" />
                <button
                  onClick={() => setMoveTarget(selectedFileObjects)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <FolderInput className="w-3 h-3" /> Déplacer
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
                <button
                  onClick={() => { setSelectedIds(new Set()); setFocusedFile(null) }}
                  className="ml-auto text-slate-600 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              /* Statut normal */
              <>
                <span className="text-[11px] text-slate-600 tabular-nums">
                  {visibleFiles.length + visibleFolders.length} élément{(visibleFiles.length + visibleFolders.length) !== 1 ? 's' : ''}
                  {totalVisibleSize > 0 && ` · ${formatSize(totalVisibleSize)}`}
                </span>
                {isSearching && (
                  <span className="text-[11px] text-[var(--color-primary)]/70">· {files.length} au total</span>
                )}
                {draggingFile && (
                  <span className="text-[11px] text-[var(--color-primary)] ml-auto">
                    {selectedIds.size > 1
                      ? `Déplacer ${selectedIds.size} fichiers…`
                      : `Dépose sur un dossier pour déplacer « ${draggingFile.name} »`
                    }
                  </span>
                )}
                {focusedFile && !draggingFile && selectedIds.size === 1 && (
                  <span className="text-[11px] text-slate-500 ml-auto">
                    « {focusedFile.mime_type === 'text/markdown'
                      ? focusedFile.name.replace(/\.md$/, '')
                      : focusedFile.name} » · {formatSize(focusedFile.size)}
                    <span className="text-slate-700 ml-1">· Espace pour aperçu</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Preview panel */}
        {focusedFile && selectedIds.size === 1 && !renamingItem && (
          <div className="w-72 flex-shrink-0 border-l border-white/[0.05] overflow-hidden">
            <FilePreview
              file={focusedFile}
              onClose={() => { setSelectedIds(new Set()); setFocusedFile(null) }}
              onOpen={openFile}
              onReveal={revealFile}
            />
          </div>
        )}
      </div>

      {/* ════ DOCK BAS — Hiérarchie dossiers ════ */}
      <div className="shrink-0 border-t border-white/[0.05] bg-slate-900/80 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-700">Dossiers</p>
          <div className="flex-1 h-px bg-white/[0.04]" />
          <button
            onClick={(e) => { e.stopPropagation(); void handleNewFolder() }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-600 hover:text-white hover:bg-white/[0.07] rounded-lg transition-colors"
          >
            <FolderPlus className="w-3 h-3" /> Nouveau
          </button>
        </div>

        <div className="flex items-end gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {/* Racine */}
          <button
            onClick={(e) => { e.stopPropagation(); navigateTo(undefined) }}
            onDragOver={(e) => { e.preventDefault(); if (draggingFile) setDragOverFolder('root') }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => void handleFolderDrop(e, null)}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all shrink-0 ${
              dragOverFolder === 'root'
                ? 'bg-[var(--color-primary)]/25 ring-2 ring-[var(--color-primary)]/50 scale-110'
                : activeFolder === undefined && !isSearching
                  ? 'bg-[var(--color-primary)]/15'
                  : 'hover:bg-white/[0.07]'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center">
              <Home className={`w-4 h-4 ${activeFolder === undefined && !isSearching ? 'text-[var(--color-primary)]' : 'text-slate-400'}`} />
            </div>
            <span className={`text-[10px] font-medium ${activeFolder === undefined && !isSearching ? 'text-[var(--color-primary)]' : 'text-slate-500'}`}>
              Fichiers
            </span>
            {activeFolder === undefined && !isSearching && (
              <div className="w-1 h-1 rounded-full bg-[var(--color-primary)]" />
            )}
          </button>

          {folders.length > 0 && <div className="w-px h-10 bg-white/[0.07] mx-1 shrink-0" />}

          {/* Dossiers */}
          {folders.map((folder) => (
            <DockFolder
              key={folder.id}
              folder={folder}
              isActive={activeFolder === folder.id && !isSearching}
              count={countInFolder(folder.id)}
              isDragOver={dragOverFolder === folder.id}
              isReorderOver={reorderOverId === folder.id}
              onClick={() => navigateTo(folder.id)}
              onDragOver={(e) => handleDockDragOver(e, folder)}
              onDragLeave={() => { setDragOverFolder(null); setReorderOverId(null) }}
              onDrop={(e) => void handleDockDrop(e, folder)}
              onContextMenu={(e) => handleFolderCtxMenu(e, folder)}
              onReorderStart={() => handleReorderStart(folder.id)}
              onReorderEnd={handleReorderEnd}
            />
          ))}

          {folders.length === 0 && (
            <p className="text-[10px] text-slate-700 italic px-2 py-2">Clic droit pour créer un dossier</p>
          )}
        </div>
      </div>

      {/* ════ OVERLAYS — via Portal au niveau du body ════ */}
      <Portal>
        {canvasCtxMenu && (
          <CanvasContextMenu
            x={canvasCtxMenu.x} y={canvasCtxMenu.y}
            view={view}
            showNewFolder={activeFolder === undefined}
            onClose={() => setCanvasCtxMenu(null)}
            onNewFolder={() => void handleNewFolder()}
            onNewNote={() => void handleNewNote()}
            onImport={() => void pickAndAdd(activeFolder)}
            onToggleView={() => setView((v) => v === 'desktop' ? 'list' : 'desktop')}
          />
        )}

        {ctxMenu && (
          <FileContextMenu
            x={ctxMenu.x} y={ctxMenu.y} file={ctxMenu.file}
            selectionCount={selectedIds.size}
            onClose={() => setCtxMenu(null)}
            onOpen={() => void openFile(ctxMenu.file.path)}
            onReveal={() => void revealFile(ctxMenu.file.path)}
            onRename={() => setRenamingItem({ id: ctxMenu.file.id, type: 'file' })}
            onMoveRequest={() => setMoveTarget(
              selectedIds.size > 1 ? selectedFileObjects : [ctxMenu.file]
            )}
            onDelete={() => {
              if (selectedIds.size > 1) void handleBulkDelete()
              else void deleteFile(ctxMenu.file.id).then(() => {
                if (focusedFile?.id === ctxMenu.file.id) setFocusedFile(null)
                setSelectedIds(new Set())
              })
            }}
          />
        )}

        {moveTarget && (
          <MoveSheet
            files={moveTarget} folders={folders}
            onMove={(fid) => {
              if (moveTarget.length > 1) handleBulkMove(fid)
              else void moveFile(moveTarget[0].id, fid)
            }}
            onClose={() => setMoveTarget(null)}
          />
        )}

        {folderCtxMenu && (
          <FolderContextMenu
            x={folderCtxMenu.x} y={folderCtxMenu.y}
            folder={folderCtxMenu.folder}
            onClose={() => setFolderCtxMenu(null)}
            onOpen={() => { navigateTo(folderCtxMenu.folder.id); setFolderCtxMenu(null) }}
            onRename={() => { setRenamingItem({ id: folderCtxMenu.folder.id, type: 'folder' }); setFolderCtxMenu(null) }}
            onSetColor={(color) => { void setFolderColor(folderCtxMenu.folder.id, color); setFolderCtxMenu(null) }}
            onDelete={() => { void handleDeleteFolder(folderCtxMenu.folder.id); setFolderCtxMenu(null) }}
          />
        )}

        {quickLookFile && (
          <QuickLookModal
            file={quickLookFile}
            onClose={() => setQuickLookFile(null)}
            onOpen={openFile}
            onReveal={revealFile}
          />
        )}
      </Portal>
    </div>
  )
}
