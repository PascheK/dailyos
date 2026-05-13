import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2 } from 'lucide-react'

// Délai avant écriture sur disque (ms) — évite d'écrire à chaque frappe
const WRITE_DEBOUNCE = 600

type Props = {
  fileId: number
  isEditing: boolean
}

export function MarkdownBlock({ fileId, isEditing }: Props): React.JSX.Element {
  const [content, setContent] = useState('')
  const [loading, setLoading]  = useState(true)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const writeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lecture initiale du fichier .md depuis le disque
  useEffect(() => {
    setLoading(true)
    window.api.files.readContent(fileId).then((c) => {
      setContent(c)
      setLoading(false)
    })
  }, [fileId])

  // Focus automatique quand on entre en mode édition (double-clic)
  useEffect(() => {
    if (isEditing && !loading && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing, loading])

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => { if (writeTimer.current) clearTimeout(writeTimer.current) }
  }, [])

  const handleChange = (newContent: string): void => {
    setContent(newContent)
    // Debounce : on écrit sur disque seulement après WRITE_DEBOUNCE ms d'inactivité
    if (writeTimer.current) clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(() => {
      window.api.files.writeContent(fileId, newContent)
    }, WRITE_DEBOUNCE)
  }

  // ── Chargement ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-slate-900"
        style={{ border: '1.5px solid #1f1f3a', borderRadius: 8 }}
      >
        <Loader2 className="w-4 h-4 text-slate-600 animate-spin" />
      </div>
    )
  }

  // ── Rendu principal ────────────────────────────────────────────────────────
  return (
    <div
      className="w-full h-full overflow-hidden flex flex-col bg-slate-900"
      style={{
        border: `1.5px solid ${isEditing ? '#6d5fff' : '#1f1f3a'}`,
        borderRadius: 8,
        transition: 'border-color 0.15s'
      }}
    >
      {/* Barre de titre du bloc */}
      <div className="flex items-center gap-1.5 px-3 h-7 shrink-0 border-b border-slate-700/50 select-none">
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isEditing ? 'bg-blue-400' : 'bg-slate-600'}`} />
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">
          {isEditing ? 'Markdown' : 'Note'}
        </span>
      </div>

      {/* Éditeur (mode édition — double-clic sur le bloc) */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={'# Titre\n\nCommence à écrire en **Markdown**...\n\n- Item 1\n- Item 2\n\n> Citation'}
          className="flex-1 w-full bg-transparent text-slate-200 resize-none focus:outline-none"
          style={{
            padding: '10px 14px',
            fontSize: '12.5px',
            fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
            lineHeight: '1.7',
            caretColor: '#9d8fff',
          }}
        />
      ) : (
        /* Preview Markdown (mode normal) */
        <div className="md-preview flex-1 overflow-auto" style={{ padding: '10px 14px' }}>
          {content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <p className="text-slate-600 text-xs italic mt-1">
              Double-cliquez pour écrire...
            </p>
          )}
        </div>
      )}
    </div>
  )
}
