import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, StickyNote } from 'lucide-react'
import { Excalidraw } from '@excalidraw/excalidraw'
// ExcalidrawImperativeAPI n'est pas ré-exporté depuis le package root — on l'extrait via les props
type ExcalidrawImperativeAPI = Parameters<
  NonNullable<React.ComponentProps<typeof Excalidraw>['excalidrawAPI']>
>[0]
import '@excalidraw/excalidraw/index.css'
import { ExcaliMath } from '@excalimath/core'
import { MarkdownBlock } from '../components/notes/MarkdownBlock'
import { useWhiteboard } from '../hooks/useWhiteboard'
import type { AppBoardFull } from '../types/whiteboard'

const DEBOUNCE_DELAY = 1500

type SaveStatus = 'saved' | 'saving' | 'unsaved'

// Type inféré depuis les props Excalidraw — évite d'importer les types internes
type RenderEmbeddableArgs = Parameters<
  NonNullable<React.ComponentProps<typeof Excalidraw>['renderEmbeddable']>
>

// customData d'un bloc markdown
type MarkdownCustomData = { type: 'markdown'; fileId: number }

export function WhiteboardEditor(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getBoard, saveBoard } = useWhiteboard()

  const [board, setBoard] = useState<AppBoardFull | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boardRef = useRef<AppBoardFull | null>(null)
  const lastJSONRef = useRef<string | null>(null)
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null)

  useEffect(() => {
    if (!id) return
    getBoard(Number(id)).then((b) => {
      setBoard(b)
      boardRef.current = b
    })
  }, [id, getBoard])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  // ── Sauvegarde debouncée du canvas (layout + éléments) ─────────────────────
  const handleChange = useCallback(
    (elements: readonly unknown[]) => {
      const json = JSON.stringify(elements)
      if (json === lastJSONRef.current) return
      lastJSONRef.current = json

      const b = boardRef.current
      if (!b) return

      setSaveStatus('unsaved')
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(async () => {
        setSaveStatus('saving')
        await saveBoard(b.id, JSON.stringify({ elements }))
        setSaveStatus('saved')
      }, DEBOUNCE_DELAY)
    },
    [saveBoard]
  )

  // ── Rendu des blocs embarqués ───────────────────────────────────────────────
  // Excalidraw appelle cette fonction pour chaque élément "embeddable".
  // Si l'élément a customData.type === 'markdown', on rend <MarkdownBlock>.
  // Le contenu est stocké dans le fichier .md (lu/écrit par MarkdownBlock via IPC).
  const renderEmbeddable = useCallback((...[element, appState]: RenderEmbeddableArgs) => {
    const data = element.customData as MarkdownCustomData | undefined
    if (data?.type !== 'markdown' || !data.fileId) return null

    const isEditing =
      (appState as { activeEmbeddable?: { element: { id: string } } }).activeEmbeddable?.element
        .id === element.id

    return <MarkdownBlock fileId={data.fileId} isEditing={isEditing} />
  }, [])

  // ── Création d'un bloc markdown ────────────────────────────────────────────
  // 1. Crée un vrai fichier .md sur le disque (visible dans l'onglet Fichiers)
  // 2. Ajoute un élément embeddable sur le canvas avec fileId dans customData
  // 3. L'URI dailyos://md/{fileId} identifie le bloc sans pointer vers un serveur réel
  const addMarkdownBlock = useCallback(async () => {
    const api = excalidrawRef.current
    if (!api) return

    // Créer le fichier .md géré par l'app
    const file = await window.api.files.createNote('note')

    const appState = api.getAppState()
    const cx = (-appState.scrollX + appState.width / 2) / appState.zoom.value
    const cy = (-appState.scrollY + appState.height / 2) / appState.zoom.value
    const W = 380,
      H = 260

    api.updateScene({
      elements: [
        ...api.getSceneElements(),
        {
          type: 'embeddable' as const,
          id: crypto.randomUUID(),
          x: cx - W / 2,
          y: cy - H / 2,
          width: W,
          height: H,
          angle: 0,
          strokeColor: '#6d5fff',
          backgroundColor: 'transparent',
          fillStyle: 'solid' as const,
          strokeWidth: 1,
          strokeStyle: 'solid' as const,
          roughness: 0,
          opacity: 100,
          groupIds: [] as string[],
          frameId: null,
          roundness: null,
          seed: Math.floor(Math.random() * 2 ** 31),
          version: 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          isDeleted: false as const,
          boundElements: null,
          updated: Date.now(),
          // URI custom — validateEmbeddable l'accepte, renderEmbeddable le gère
          link: `dailyos://md/${file.id}`,
          locked: false,
          // Le contenu est dans le fichier, pas ici — on stocke seulement l'ID
          customData: { type: 'markdown', fileId: file.id } satisfies MarkdownCustomData
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any
      ],
      captureUpdate: 'IMMEDIATELY'
    })
  }, [])

  // ── Rendu ──────────────────────────────────────────────────────────────────
  if (!board) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    )
  }

  const initialElements = (() => {
    try {
      return JSON.parse(board.data).elements ?? []
    } catch {
      return []
    }
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Barre du haut */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-slate-700/60 bg-slate-900 shrink-0">
        <button
          onClick={() => navigate('/canvas')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>

        <div className="w-px h-4 bg-slate-700 shrink-0" />
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: board.color }} />
        <span className="text-sm font-medium text-slate-100 truncate">{board.title}</span>

        {/* Bouton insertion bloc MD */}
        <button
          onClick={() => {
            void addMarkdownBlock()
          }}
          title="Insérer un bloc Note (Markdown)"
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors shrink-0"
        >
          <StickyNote className="w-3.5 h-3.5" />
          Bloc note
        </button>

        {/* Statut de sauvegarde */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 text-slate-500 animate-spin" />
              <span className="text-slate-500">Sauvegarde...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-slate-500">Sauvegardé</span>
            </>
          )}
          {saveStatus === 'unsaved' && <span className="text-slate-600">Non sauvegardé</span>}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Excalidraw
          excalidrawAPI={(api) => {
            excalidrawRef.current = api
          }}
          initialData={{ elements: initialElements }}
          onChange={(elements) => handleChange(elements as readonly unknown[])}
          renderEmbeddable={renderEmbeddable}
          validateEmbeddable={(link) =>
            // Accepte uniquement nos URIs custom — les autres (YouTube, Figma…) restent normaux
            typeof link === 'string' && link.startsWith('dailyos://md/')
          }
          renderTopRightUI={() =>
            excalidrawRef.current ? (
              <ExcaliMath
                excalidrawAPI={excalidrawRef.current}
                enabledPlugins={['equation', 'graph', 'library']}
                theme="auto"
                onSave={(data: unknown) => console.log('Saved:', data)}
              />
            ) : null
          }
          theme="dark"
          langCode="fr-FR"
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              toggleTheme: false
            }
          }}
        />
      </div>
    </div>
  )
}
