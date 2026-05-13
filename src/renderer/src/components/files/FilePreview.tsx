import { useState, useEffect, useCallback } from 'react'
import {
  X, ExternalLink, FolderOpen, FileText, Image,
  Film, Music, Code, File, Loader2, AlertCircle, ZoomIn, ZoomOut
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AppFile } from '../../types/files'

// ── Utilitaires ──────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function getCategory(mimeType: string): 'img' | 'video' | 'audio' | 'pdf' | 'markdown' | 'code' | 'text' | 'other' {
  if (mimeType.startsWith('image/')) return 'img'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'text/markdown') return 'markdown'
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('html') ||
    mimeType.includes('css') ||
    mimeType.includes('xml')
  ) return 'code'
  return 'other'
}

function getLanguage(mimeType: string, name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const extMap: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (JSX)', js: 'JavaScript', jsx: 'JavaScript (JSX)',
    json: 'JSON', html: 'HTML', css: 'CSS', scss: 'SCSS',
    py: 'Python', rs: 'Rust', go: 'Go', java: 'Java',
    c: 'C', cpp: 'C++', cs: 'C#', sh: 'Shell',
    sql: 'SQL', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    xml: 'XML', md: 'Markdown', txt: 'Texte brut'
  }
  return extMap[ext] ?? mimeType
}

// ── Prévisualisation image avec zoom ────────────────────────────────────────

function ImagePreview({ path }: { path: string }): React.JSX.Element {
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className="flex flex-col h-full">
      {/* Contrôles zoom */}
      <div className="flex items-center justify-center gap-2 p-2 border-b border-slate-700/50">
        <button
          onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="text-xs text-slate-500 hover:text-white transition-colors px-2"
        >
          Réinitialiser
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/30">
        {!loaded && !error && (
          <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
        )}
        {error ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm">Impossible de charger l'image</p>
          </div>
        ) : (
          <img
            src={`local-file://${path}`}
            alt=""
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.15s ease' }}
            className="max-w-full object-contain"
            onLoad={() => setLoaded(true)}
            onError={() => { setLoaded(true); setError(true) }}
          />
        )}
      </div>
    </div>
  )
}

// ── Prévisualisation PDF ─────────────────────────────────────────────────────

function PdfPreview({ path }: { path: string }): React.JSX.Element {
  return (
    <iframe
      src={`local-file://${path}`}
      className="w-full h-full border-none"
      title="PDF preview"
    />
  )
}

// ── Prévisualisation vidéo ────────────────────────────────────────────────────

function VideoPreview({ path }: { path: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full p-4 bg-black/40">
      <video
        src={`local-file://${path}`}
        controls
        className="max-w-full max-h-full rounded-lg shadow-2xl"
      />
    </div>
  )
}

// ── Prévisualisation audio ────────────────────────────────────────────────────

function AudioPreview({ file }: { file: AppFile }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="w-28 h-28 rounded-3xl bg-pink-500/20 flex items-center justify-center">
        <Music className="w-14 h-14 text-pink-400" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{file.name}</p>
        <p className="text-sm text-slate-500 mt-1">{formatSize(file.size)}</p>
      </div>
      <audio
        src={`local-file://${file.path}`}
        controls
        className="w-full max-w-xs"
      />
    </div>
  )
}

// ── Prévisualisation texte / code ────────────────────────────────────────────

function TextPreview({
  fileId, mimeType, name
}: { fileId: number; mimeType: string; name: string }): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    window.api.files.readContent(fileId)
      .then((c) => { setContent(c); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [fileId])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
    </div>
  )

  if (error || content === null) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
      <AlertCircle className="w-8 h-8" />
      <p className="text-sm">Impossible de lire le fichier</p>
    </div>
  )

  const lang = getLanguage(mimeType, name)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-slate-700/50 flex items-center gap-2">
        <Code className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-xs text-slate-400">{lang}</span>
        <span className="text-xs text-slate-600 ml-auto">{content.split('\n').length} lignes</span>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    </div>
  )
}

// ── Prévisualisation Markdown ────────────────────────────────────────────────

function MarkdownPreview({ fileId }: { fileId: number }): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    window.api.files.readContent(fileId)
      .then((c) => { setContent(c); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [fileId])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
    </div>
  )

  if (error || content === null) return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
      <AlertCircle className="w-8 h-8" />
      <p className="text-sm">Impossible de lire le fichier</p>
    </div>
  )

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="md-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// ── Fichier non prévisualisable ───────────────────────────────────────────────

function UnsupportedPreview({ file, onOpen }: { file: AppFile; onOpen: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-8">
      <div className="w-24 h-24 rounded-3xl bg-slate-700 flex items-center justify-center">
        <File className="w-12 h-12 text-slate-400" />
      </div>
      <div className="text-center">
        <p className="font-semibold text-white">{file.name}</p>
        <p className="text-sm text-slate-500 mt-1">{file.mime_type}</p>
        <p className="text-sm text-slate-500">{formatSize(file.size)}</p>
      </div>
      <button
        onClick={onOpen}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
      >
        <ExternalLink className="w-4 h-4" />
        Ouvrir dans l'application par défaut
      </button>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

type FilePreviewProps = {
  file: AppFile
  onClose: () => void
  onOpen: (path: string) => void
  onReveal: (path: string) => void
}

export function FilePreview({ file, onClose, onOpen, onReveal }: FilePreviewProps): React.JSX.Element {
  const category = getCategory(file.mime_type)

  const categoryIcon: Record<string, React.JSX.Element> = {
    img:      <Image  className="w-4 h-4 text-green-400" />,
    video:    <Film   className="w-4 h-4 text-purple-400" />,
    audio:    <Music  className="w-4 h-4 text-pink-400" />,
    pdf:      <FileText className="w-4 h-4 text-red-400" />,
    markdown: <FileText className="w-4 h-4 text-blue-400" />,
    code:     <Code   className="w-4 h-4 text-yellow-400" />,
    text:     <FileText className="w-4 h-4 text-blue-400" />,
    other:    <File   className="w-4 h-4 text-slate-400" />
  }

  const renderContent = useCallback((): React.JSX.Element => {
    switch (category) {
      case 'img':
        return <ImagePreview path={file.path} />
      case 'video':
        return <VideoPreview path={file.path} />
      case 'audio':
        return <AudioPreview file={file} />
      case 'pdf':
        return <PdfPreview path={file.path} />
      case 'markdown':
        return <MarkdownPreview fileId={file.id} />
      case 'code':
      case 'text':
        return <TextPreview fileId={file.id} mimeType={file.mime_type} name={file.name} />
      default:
        return <UnsupportedPreview file={file} onOpen={() => onOpen(file.path)} />
    }
  }, [category, file, onOpen])

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700/50">
      {/* ── En-tête ────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 border-b border-slate-700/50 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {categoryIcon[category]}
            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>{formatSize(file.size)}</span>
            <span>·</span>
            <span>{formatDate(file.created_at)}</span>
            {file.folder && (
              <>
                <span>·</span>
                <span className="truncate">{file.folder}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onOpen(file.path)}
            title="Ouvrir externalement"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={() => onReveal(file.path)}
            title="Révéler dans le Finder"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Fermer"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Contenu ─────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  )
}
