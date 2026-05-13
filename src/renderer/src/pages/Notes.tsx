import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { createTheme } from '@uiw/codemirror-themes'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Plus,
  Search,
  Trash2,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Eye,
  Columns2,
  Edit3,
  FileText,
  Loader2,
  SquareCode,
  Check,
  X
} from 'lucide-react'
import type { AppFile } from '../types/files'

// ── Thème CodeMirror — palette slate de l'app ─────────────────────────────

const notesTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'transparent',
    foreground: '#cbd5e1', // slate-300
    caret: '#818cf8', // indigo-400
    selection: '#334155', // slate-700
    selectionMatch: '#1e293b80',
    lineHighlight: '#1e293b60',
    gutterBackground: 'transparent',
    gutterForeground: '#475569',
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: '14px'
  },
  styles: [
    { tag: t.heading1, color: '#f8fafc', fontWeight: '700', fontSize: '1.6em', lineHeight: '1.3' },
    { tag: t.heading2, color: '#f1f5f9', fontWeight: '700', fontSize: '1.35em', lineHeight: '1.3' },
    { tag: t.heading3, color: '#e2e8f0', fontWeight: '600', fontSize: '1.1em' },
    { tag: t.heading, color: '#e2e8f0', fontWeight: '600' },
    { tag: t.strong, color: '#f8fafc', fontWeight: '700' },
    { tag: t.emphasis, color: '#c7d2fe', fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through', color: '#64748b' },
    { tag: t.link, color: '#818cf8', textDecoration: 'underline' },
    { tag: t.url, color: '#6366f1' },
    { tag: t.monospace, color: '#fbbf24', fontFamily: 'monospace' },
    { tag: t.processingInstruction, color: '#475569' }, // # * _ etc.
    { tag: t.punctuation, color: '#475569' },
    { tag: t.meta, color: '#94a3b8' },
    { tag: t.quote, color: '#94a3b8', fontStyle: 'italic' },
    { tag: t.list, color: '#6366f1' },
    { tag: t.atom, color: '#fbbf24' } // checkboxes [ ] [x]
  ]
})

// ── Utilitaires ──────────────────────────────────────────────────────────────

const WRITE_DEBOUNCE = 800

function displayName(file: AppFile): string {
  return file.name.replace(/\.md$/, '')
}

function formatRelDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffD = Math.floor(diffMs / 86400000)
  if (diffD === 0) return "Aujourd'hui"
  if (diffD === 1) return 'Hier'
  if (diffD < 7) return `Il y a ${diffD} j`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── Item de la liste de notes ────────────────────────────────────────────────

type NoteItemProps = {
  note: AppFile
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (newName: string) => void
}

function NoteItem({
  note,
  isActive,
  onClick,
  onDelete,
  onRename
}: NoteItemProps): React.JSX.Element {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(displayName(note))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) inputRef.current?.select()
  }, [renaming])

  const commitRename = (): void => {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== displayName(note)) onRename(trimmed)
    else setDraftName(displayName(note))
    setRenaming(false)
  }

  return (
    <div
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setRenaming(true)
      }}
      className={`group relative flex flex-col px-3 py-2.5 rounded-lg cursor-pointer transition-colors border ${
        isActive
          ? 'bg-[color:var(--color-primary)]/15 border-[color:var(--color-primary)]/30 text-white'
          : 'border-transparent hover:bg-slate-700/60 text-slate-300 hover:text-white'
      }`}
    >
      {renaming ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setDraftName(displayName(note))
                setRenaming(false)
              }
            }}
            onBlur={commitRename}
            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-sm text-white focus:outline-none focus:border-indigo-500 min-w-0"
          />
        </div>
      ) : (
        <>
          <span className="text-sm font-medium truncate pr-6">{displayName(note)}</span>
          <span className="text-xs text-slate-500 mt-0.5">{formatRelDate(note.created_at)}</span>
          {/* Bouton suppression */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )
}

// ── Bouton de toolbar ────────────────────────────────────────────────────────

type ToolbarBtnProps = {
  title: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}

function ToolbarBtn({ title, onClick, active, children }: ToolbarBtnProps): React.JSX.Element {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors text-sm font-bold ${
        active
          ? 'bg-[color:var(--color-primary)]/20 text-[color:var(--color-primary)]'
          : 'text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ── Page Notes ───────────────────────────────────────────────────────────────

type Mode = 'edit' | 'split' | 'preview'

export function Notes(): React.JSX.Element {
  const [notes, setNotes] = useState<AppFile[]>([])
  const [selected, setSelected] = useState<AppFile | null>(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [mode, setMode] = useState<Mode>('split')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const editorViewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDirty = content !== savedContent

  // ── Chargement des notes (tous les .md) ─────────────────────────────────

  const loadNotes = useCallback(async () => {
    const all = await window.api.files.list()
    const mds = all.filter((f) => f.mime_type === 'text/markdown')
    setNotes(mds)
  }, [])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // ── Sélection d'une note ─────────────────────────────────────────────────

  const selectNote = useCallback(
    async (note: AppFile) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      // Sauvegarde immédiate si modifié avant de changer de note
      if (selected && isDirty) {
        await window.api.files.writeContent(selected.id, content)
      }
      setSelected(note)
      setLoading(true)
      const text = await window.api.files.readContent(note.id)
      setContent(text)
      setSavedContent(text)
      setLoading(false)
    },
    [selected, isDirty, content]
  )

  // ── Changement de contenu + sauvegarde auto ──────────────────────────────

  const handleChange = useCallback(
    (value: string) => {
      setContent(value)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (!selected) return
      saveTimerRef.current = setTimeout(async () => {
        await window.api.files.writeContent(selected.id, value)
        setSavedContent(value)
      }, WRITE_DEBOUNCE)
    },
    [selected]
  )

  // Sauvegarde au démontage
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Nouvelle note ────────────────────────────────────────────────────────

  const createNote = useCallback(async () => {
    setCreating(true)
    const note = await window.api.files.createNote('Nouvelle note')
    await loadNotes()
    await selectNote(note)
    setCreating(false)
  }, [loadNotes, selectNote])

  // ── Suppression de note ──────────────────────────────────────────────────

  const deleteNote = useCallback(
    async (note: AppFile) => {
      await window.api.files.delete(note.id)
      if (selected?.id === note.id) {
        setSelected(null)
        setContent('')
        setSavedContent('')
      }
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    },
    [selected]
  )

  // ── Renommage de note ────────────────────────────────────────────────────

  const renameNote = useCallback(
    async (note: AppFile, newName: string) => {
      const result = await window.api.files.renameNote(note.id, newName)
      if (!result) return
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, name: result.name, path: result.path } : n))
      )
      if (selected?.id === note.id) {
        setSelected((prev) => (prev ? { ...prev, name: result.name, path: result.path } : prev))
      }
    },
    [selected]
  )

  // ── Insertion de markdown via la toolbar ─────────────────────────────────

  const insertInline = useCallback((before: string, after = '', placeholder = 'texte') => {
    const view = editorViewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const sel = view.state.sliceDoc(from, to)
    const text = sel || placeholder
    view.dispatch({
      changes: { from, to, insert: `${before}${text}${after}` },
      selection: { anchor: from + before.length, head: from + before.length + text.length }
    })
    view.focus()
  }, [])

  const insertLinePrefix = useCallback((prefix: string) => {
    const view = editorViewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    if (line.text.startsWith(prefix)) {
      view.dispatch({ changes: { from: line.from, to: line.from + prefix.length, insert: '' } })
    } else {
      view.dispatch({ changes: { from: line.from, insert: prefix } })
    }
    view.focus()
  }, [])

  const insertBlock = useCallback((block: string) => {
    const view = editorViewRef.current
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const atEnd = line.to
    view.dispatch({
      changes: { from: atEnd, insert: `\n${block}` },
      selection: { anchor: atEnd + block.length + 1 }
    })
    view.focus()
  }, [])

  // ── Liste filtrée ────────────────────────────────────────────────────────

  const filtered = useMemo(
    () => notes.filter((n) => displayName(n).toLowerCase().includes(search.toLowerCase())),
    [notes, search]
  )

  // ── Extensions CodeMirror ────────────────────────────────────────────────

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage }),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto', padding: '16px 24px', fontFamily: 'inherit' },
        '.cm-content': { paddingBottom: '40vh', maxWidth: '780px', margin: '0 auto' },
        '.cm-line': { padding: '0' },
        '.cm-activeLine': { backgroundColor: 'transparent' },
        '.cm-cursor': { borderLeftWidth: '2px' }
      })
    ],
    []
  )

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sidebar notes ─────────────────────────────────────────────────── */}
      <div className="w-64 bg-slate-900 border-r border-slate-700/50 flex flex-col flex-shrink-0">
        {/* En-tête sidebar */}
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-300">Notes</span>
          <button
            onClick={createNote}
            disabled={creating}
            title="Nouvelle note (⌘N)"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Recherche */}
        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto px-2 pb-4 flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-slate-600">
              <FileText className="w-8 h-8 opacity-40" />
              <p className="text-xs text-center">
                {notes.length === 0 ? 'Aucune note.\nCliquez sur + pour créer.' : 'Aucun résultat.'}
              </p>
            </div>
          ) : (
            filtered.map((note) => (
              <NoteItem
                key={note.id}
                note={note}
                isActive={selected?.id === note.id}
                onClick={() => selectNote(note)}
                onDelete={() => deleteNote(note)}
                onRename={(name) => renameNote(note, name)}
              />
            ))
          )}
        </div>

        {/* Compteur */}
        <div className="px-4 py-2 border-t border-slate-700/50 text-xs text-slate-600">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Zone principale ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {selected ? (
          <>
            {/* ── Topbar ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
              {/* Titre de la note (éditable inline) */}
              <NoteTitle note={selected} onRename={(name) => renameNote(selected, name)} />

              {/* Indicateur sauvegarde */}
              <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
                {isDirty ? (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400"
                    title="Modifications non sauvegardées"
                  />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className={isDirty ? 'text-amber-400/80' : 'text-emerald-500/70'}>
                  {isDirty ? 'Non sauvegardé' : 'Sauvegardé'}
                </span>
              </div>

              {/* Séparateur */}
              <div className="flex-1" />

              {/* Toolbar formatage */}
              <div className="flex items-center gap-0.5 border-r border-slate-700 pr-3 mr-1">
                <ToolbarBtn
                  title="Gras (⌘B)"
                  onClick={() => insertInline('**', '**', 'texte en gras')}
                >
                  <Bold className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Italique (⌘I)"
                  onClick={() => insertInline('*', '*', 'texte en italique')}
                >
                  <Italic className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Code inline" onClick={() => insertInline('`', '`', 'code')}>
                  <Code className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Lien"
                  onClick={() => insertInline('[', '](url)', 'texte du lien')}
                >
                  <Link className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>

              <div className="flex items-center gap-0.5 border-r border-slate-700 pr-3 mr-1">
                <ToolbarBtn title="Titre H1" onClick={() => insertLinePrefix('# ')}>
                  <Heading1 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Titre H2" onClick={() => insertLinePrefix('## ')}>
                  <Heading2 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Titre H3" onClick={() => insertLinePrefix('### ')}>
                  <Heading3 className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>

              <div className="flex items-center gap-0.5 border-r border-slate-700 pr-3 mr-1">
                <ToolbarBtn title="Liste à puces" onClick={() => insertLinePrefix('- ')}>
                  <List className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Liste numérotée" onClick={() => insertLinePrefix('1. ')}>
                  <ListOrdered className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Citation" onClick={() => insertLinePrefix('> ')}>
                  <Quote className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn title="Bloc de code" onClick={() => insertBlock('```\n\n```')}>
                  <SquareCode className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>

              {/* Sélecteur de mode */}
              <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
                <ToolbarBtn
                  title="Éditeur"
                  active={mode === 'edit'}
                  onClick={() => setMode('edit')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Vue partagée"
                  active={mode === 'split'}
                  onClick={() => setMode('split')}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  title="Aperçu"
                  active={mode === 'preview'}
                  onClick={() => setMode('preview')}
                >
                  <Eye className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>
            </div>

            {/* ── Zone éditeur / aperçu ──────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">
              {/* Éditeur CodeMirror */}
              {(mode === 'edit' || mode === 'split') && (
                <div
                  className={`flex flex-col overflow-hidden ${mode === 'split' ? 'w-1/2 border-r border-slate-800' : 'flex-1'}`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                    </div>
                  ) : (
                    <CodeMirror
                      value={content}
                      onChange={handleChange}
                      extensions={extensions}
                      theme={notesTheme}
                      onCreateEditor={(view) => {
                        editorViewRef.current = view
                      }}
                      basicSetup={{
                        lineNumbers: false,
                        foldGutter: false,
                        dropCursor: false,
                        allowMultipleSelections: true,
                        indentOnInput: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: false,
                        rectangularSelection: false,
                        crosshairCursor: false,
                        highlightActiveLine: true,
                        highlightSelectionMatches: true,
                        closeBracketsKeymap: true,
                        searchKeymap: true,
                        tabSize: 2
                      }}
                      style={{ height: '100%', overflow: 'hidden' }}
                    />
                  )}
                </div>
              )}

              {/* Aperçu Markdown */}
              {(mode === 'preview' || mode === 'split') && (
                <div className={`overflow-auto ${mode === 'split' ? 'w-1/2' : 'flex-1'}`}>
                  <div className="max-w-[780px] mx-auto px-6 py-4 md-preview">
                    {content.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    ) : (
                      <p className="text-slate-600 italic text-sm">Rien à afficher…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ── Empty state ──────────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center h-full gap-5 text-slate-600">
            <FileText className="w-16 h-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium text-slate-500">Aucune note sélectionnée</p>
              <p className="text-sm mt-1">
                Choisissez une note dans la liste ou créez-en une nouvelle.
              </p>
            </div>
            <button
              onClick={createNote}
              className="flex items-center gap-2 px-5 py-2.5 bg-[color:var(--color-primary)] hover:brightness-110 text-white rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouvelle note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Titre de la note (éditable au double-clic) ───────────────────────────────

function NoteTitle({
  note,
  onRename
}: {
  note: AppFile
  onRename: (name: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayName(note))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(displayName(note))
    setEditing(false)
  }, [note.id])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = (): void => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== displayName(note)) onRename(trimmed)
    else setDraft(displayName(note))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(displayName(note))
              setEditing(false)
            }
          }}
          onBlur={commit}
          className="flex-1 min-w-0 bg-slate-800 border border-indigo-500/60 rounded-lg px-3 py-1 text-sm font-semibold text-white focus:outline-none"
        />
        <button onClick={commit} className="text-slate-500 hover:text-white transition-colors">
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setDraft(displayName(note))
            setEditing(false)
          }}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <h1
      onDoubleClick={() => setEditing(true)}
      title="Double-cliquer pour renommer"
      className="text-sm font-semibold text-slate-200 truncate max-w-xs cursor-default select-none hover:text-white transition-colors"
    >
      {displayName(note)}
    </h1>
  )
}
