import { useState, useEffect, useRef } from 'react'
import {
  Upload, Search, Grid, List, Folder, FileText, Image, Film,
  Music, File, Code, MoreHorizontal, FolderPlus, ExternalLink,
  Trash2, FolderInput, X
} from 'lucide-react'
import { useFiles } from '../hooks/useFiles'
import type { AppFile, AppFolder } from '../types/files'
import { FilePreview } from '../components/files/FilePreview'

// ── Utilitaires ──────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'img'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (
    mimeType.includes('text/') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  ) return 'code'
  if (
    mimeType.includes('word') ||
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown'
  ) return 'doc'
  return 'other'
}

// ── Icône de fichier ─────────────────────────────────────────────────────────

function FileIcon({ mimeType, size = 'md' }: { mimeType: string; size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  const category = getFileCategory(mimeType)
  const iconSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'
  const boxSize = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10'

  const config: Record<string, { bg: string; color: string; icon: React.JSX.Element }> = {
    pdf:   { bg: 'bg-red-500/20',    color: 'text-red-400',    icon: <FileText className={iconSize} /> },
    doc:   { bg: 'bg-blue-500/20',   color: 'text-blue-400',   icon: <FileText className={iconSize} /> },
    img:   { bg: 'bg-green-500/20',  color: 'text-green-400',  icon: <Image    className={iconSize} /> },
    video: { bg: 'bg-purple-500/20', color: 'text-purple-400', icon: <Film     className={iconSize} /> },
    audio: { bg: 'bg-pink-500/20',   color: 'text-pink-400',   icon: <Music    className={iconSize} /> },
    code:  { bg: 'bg-yellow-500/20', color: 'text-yellow-400', icon: <Code     className={iconSize} /> },
    other: { bg: 'bg-slate-700',     color: 'text-slate-400',  icon: <File     className={iconSize} /> }
  }

  const { bg, color, icon } = config[category] ?? config.other
  return (
    <div className={`${boxSize} rounded-xl flex items-center justify-center flex-shrink-0 ${bg} ${color}`}>
      {icon}
    </div>
  )
}

// ── Menu contextuel ──────────────────────────────────────────────────────────

type FileMenuProps = {
  file: AppFile
  folders: AppFolder[]
  onOpen: () => void
  onReveal: () => void
  onMove: (folderId: number | null) => void
  onDelete: () => void
}

function FileMenu({ file, folders, onOpen, onReveal, onMove, onDelete }: FileMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowMove(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const otherFolders = folders.filter((f) => f.id !== file.folder_id)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 transition-all"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-1">
          <button
            onClick={() => { onOpen(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Ouvrir
          </button>
          <button
            onClick={() => { onReveal(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Folder className="w-4 h-4" /> Révéler dans le Finder
          </button>

          <div className="h-px bg-slate-700 my-1" />

          {/* Déplacer vers un dossier */}
          <button
            onClick={() => setShowMove((s) => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <FolderInput className="w-4 h-4" />
            <span className="flex-1 text-left">Déplacer vers…</span>
          </button>

          {showMove && (
            <>
              {/* Retirer du dossier (si le fichier est dans un dossier) */}
              {file.folder_id !== null && (
                <button
                  onClick={() => { onMove(null); setOpen(false) }}
                  className="w-full flex items-center gap-2 pl-9 pr-3 py-2 text-sm text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors italic"
                >
                  Retirer du dossier
                </button>
              )}
              {otherFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { onMove(f.id); setOpen(false) }}
                  className="w-full flex items-center gap-2 pl-9 pr-3 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  {f.name}
                </button>
              ))}
              {otherFolders.length === 0 && file.folder_id !== null && (
                <p className="pl-9 pr-3 py-2 text-xs text-slate-600">Aucun autre dossier</p>
              )}
              {otherFolders.length === 0 && file.folder_id === null && (
                <p className="pl-9 pr-3 py-2 text-xs text-slate-600">Créez d'abord un dossier</p>
              )}
            </>
          )}

          <div className="h-px bg-slate-700 my-1" />
          <button
            onClick={() => { onDelete(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sidebar — item dossier avec menu ─────────────────────────────────────────

type FolderItemProps = {
  folder: AppFolder
  isActive: boolean
  count: number
  onClick: () => void
  onDelete: () => void
}

function FolderItem({ folder, isActive, count, onClick, onDelete }: FolderItemProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div ref={ref} className="relative group/folder">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <Folder className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <span className="text-xs opacity-60">{count}</span>
      </button>

      {/* Bouton suppression visible au hover */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover/folder:opacity-100 hover:bg-slate-600 text-slate-500 hover:text-white transition-all"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {menuOpen && (
        <div className="absolute left-full top-0 ml-1 z-50 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1">
          <button
            onClick={() => { onDelete(); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export function Files(): React.JSX.Element {
  const [view, setView] = useState<'grid' | 'list'>('list')
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<number | undefined>(undefined)
  const [selectedFile, setSelectedFile] = useState<AppFile | null>(null)

  // Création de dossier inline
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const newFolderInputRef = useRef<HTMLInputElement>(null)

  const {
    files, folders,
    loadFiles, loadFolders,
    pickAndAdd, openFile, revealFile, moveFile, deleteFile,
    createFolder, deleteFolder
  } = useFiles()

  useEffect(() => {
    loadFiles()
    loadFolders()
  }, [loadFiles, loadFolders])

  // Focus automatique quand l'input de création apparaît
  useEffect(() => {
    if (creatingFolder) newFolderInputRef.current?.focus()
  }, [creatingFolder])

  const handleFolderClick = (folderId: number | undefined): void => {
    setActiveFolder(folderId)
    loadFiles(folderId)
  }

  const handleCreateFolder = async (): Promise<void> => {
    const name = newFolderName.trim()
    if (!name) { cancelCreating(); return }
    await createFolder(name)
    setNewFolderName('')
    setCreatingFolder(false)
  }

  const cancelCreating = (): void => {
    setNewFolderName('')
    setCreatingFolder(false)
  }

  const handleDeleteFolder = async (id: number): Promise<void> => {
    await deleteFolder(id)
    // Si on était dans ce dossier, revenir à "Tous"
    if (activeFolder === id) handleFolderClick(undefined)
  }

  const handleSelectFile = (file: AppFile): void => {
    setSelectedFile((prev) => (prev?.id === file.id ? null : file))
  }

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))

  const countInFolder = (folderId: number): number =>
    files.filter((f) => f.folder_id === folderId).length

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar dossiers ─────────────────────────── */}
      <div className="w-56 bg-slate-800/50 border-r border-slate-700/50 flex flex-col p-4 gap-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Dossiers
          </span>
          <button
            onClick={() => setCreatingFolder(true)}
            title="Nouveau dossier"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Tous les fichiers */}
        <button
          onClick={() => handleFolderClick(undefined)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            activeFolder === undefined
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span className="flex-1 text-left">Tous les fichiers</span>
          <span className="text-xs opacity-60">{files.length}</span>
        </button>

        {/* Dossiers créés */}
        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            isActive={activeFolder === folder.id}
            count={countInFolder(folder.id)}
            onClick={() => handleFolderClick(folder.id)}
            onDelete={() => handleDeleteFolder(folder.id)}
          />
        ))}

        {/* Input inline de création */}
        {creatingFolder && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-700/50 border border-slate-600">
            <Folder className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') cancelCreating()
              }}
              placeholder="Nom du dossier"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none min-w-0"
            />
            <button onClick={cancelCreating} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Contenu principal + prévisualisation ─────── */}
      <div className="flex-1 flex overflow-hidden">
      {/* Liste de fichiers */}
      <div className={`flex flex-col overflow-hidden transition-all duration-200 ${selectedFile ? 'flex-1' : 'flex-1'}`}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-700/50">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher un fichier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded transition-colors ${view === 'list' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded transition-colors ${view === 'grid' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => pickAndAdd(activeFolder)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors text-white"
          >
            <Upload className="w-4 h-4" />
            Importer
          </button>
        </div>

        {/* Fichiers */}
        <div className="flex-1 overflow-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <File className="w-12 h-12 opacity-30" />
              <p className="text-sm">
                {files.length === 0 ? 'Aucun fichier — cliquez sur Importer' : 'Aucun fichier trouvé'}
              </p>
            </div>
          ) : view === 'list' ? (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[auto_1fr_120px_100px_100px_40px] gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span />
                <span>Nom</span>
                <span>Dossier</span>
                <span>Taille</span>
                <span>Date</span>
                <span />
              </div>
              {filtered.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  onDoubleClick={() => openFile(file.path)}
                  className={`grid grid-cols-[auto_1fr_120px_100px_100px_40px] gap-4 items-center px-4 py-3 rounded-xl transition-colors cursor-pointer group ${
                    selectedFile?.id === file.id
                      ? 'bg-blue-500/15 border border-blue-500/30'
                      : 'hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <FileIcon mimeType={file.mime_type} />
                  <span className="text-sm font-medium text-white truncate">{file.name}</span>
                  <span className="text-xs text-slate-500 truncate">{file.folder ?? '—'}</span>
                  <span className="text-xs text-slate-500">{formatSize(file.size)}</span>
                  <span className="text-xs text-slate-500">{formatDate(file.created_at)}</span>
                  <FileMenu
                    file={file}
                    folders={folders}
                    onOpen={() => openFile(file.path)}
                    onReveal={() => revealFile(file.path)}
                    onMove={(folderId) => moveFile(file.id, folderId)}
                    onDelete={() => deleteFile(file.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedFile ? 'grid-cols-2' : 'grid-cols-4'}`}>
              {filtered.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  onDoubleClick={() => openFile(file.path)}
                  className={`border rounded-2xl p-4 flex flex-col gap-3 transition-colors cursor-pointer group ${
                    selectedFile?.id === file.id
                      ? 'bg-blue-500/10 border-blue-500/40'
                      : 'bg-slate-800 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <FileIcon mimeType={file.mime_type} size="lg" />
                    <FileMenu
                      file={file}
                      folders={folders}
                      onOpen={() => openFile(file.path)}
                      onReveal={() => revealFile(file.path)}
                      onMove={(folderId) => moveFile(file.id, folderId)}
                      onDelete={() => deleteFile(file.id)}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{file.folder ?? 'Sans dossier'}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      {formatSize(file.size)} · {formatDate(file.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>{/* fin liste fichiers */}

      {/* ── Panneau de prévisualisation ──────────────── */}
      {selectedFile && (
        <div className="w-96 flex-shrink-0 overflow-hidden">
          <FilePreview
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onOpen={openFile}
            onReveal={revealFile}
          />
        </div>
      )}
      </div>{/* fin wrapper contenu + preview */}
    </div>
  )
}
