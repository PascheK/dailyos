/**
 * AiStreamContext — état global du streaming IA.
 *
 * Les listeners IPC (onChunk / onDone / onError) sont montés UNE SEULE FOIS
 * dans ce provider (App-level) et survivent aux navigations.
 * La page IA lit depuis ce contexte ; la Sidebar affiche un badge de notification.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiStreamState = {
  /** ID de la conversation en cours de streaming (null = pas de stream actif) */
  streamingConvId: number | null
  /** ID du message en train d'être écrit */
  streamingMsgId: string | null
  /** Contenu accumulé pendant le stream */
  streamingContent: string
  /** True pendant le stream */
  isStreaming: boolean
  /** True quand l'IA a terminé et que l'utilisateur n'est pas sur la page IA */
  hasNotification: boolean
  /** Action détectée par l'IA (à confirmer dans un modal) */
  pendingAction: AiAction | null
}

type AiStreamCtx = AiStreamState & {
  /** Démarre un nouveau stream (appelé par la page IA avant d'envoyer le message) */
  startStream: (convId: number, msgId: string) => void
  /** Appelé par la page IA quand elle est montée et visible */
  markAiVisible: (visible: boolean) => void
  /** Efface la notification de badge sidebar */
  clearNotification: () => void
  /** Efface l'action pending (après fermeture du modal) */
  clearPendingAction: () => void
}

const AiStreamContext = createContext<AiStreamCtx | null>(null)

export function useAiStream(): AiStreamCtx {
  const ctx = useContext(AiStreamContext)
  if (!ctx) throw new Error('useAiStream must be used inside AiStreamProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AiStreamProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<AiStreamState>({
    streamingConvId:  null,
    streamingMsgId:   null,
    streamingContent: '',
    isStreaming:      false,
    hasNotification:  false,
    pendingAction:    null,
  })

  // Ref mutable pour ne pas recréer les listeners à chaque render
  const aiVisible   = useRef(false)
  const streamIdRef = useRef<string | null>(null)

  // ── Listeners IPC (montés une seule fois) ─────────────────────────────────

  useEffect(() => {
    const offChunk = window.api.ai.onChunk((text) => {
      setState(prev => ({
        ...prev,
        streamingContent: prev.streamingContent + text,
      }))
    })

    const offDone = window.api.ai.onDone(({ cleanContent, action }) => {
      setState(prev => ({
        ...prev,
        streamingContent: cleanContent,
        isStreaming:      false,
        streamingMsgId:   null,
        // Notification uniquement si l'utilisateur n'est pas sur la page IA
        hasNotification:  !aiVisible.current,
        pendingAction:    action as AiAction | null,
      }))
      streamIdRef.current = null
    })

    const offError = window.api.ai.onError((_msg) => {
      setState(prev => ({
        ...prev,
        isStreaming:      false,
        streamingMsgId:   null,
        streamingContent: '',
      }))
      streamIdRef.current = null
    })

    return () => { offChunk(); offDone(); offError() }
  }, [])

  // ── API exposée ───────────────────────────────────────────────────────────

  const startStream = (convId: number, msgId: string): void => {
    streamIdRef.current = msgId
    setState(prev => ({
      ...prev,
      streamingConvId:  convId,
      streamingMsgId:   msgId,
      streamingContent: '',
      isStreaming:      true,
      hasNotification:  false,
    }))
  }

  const markAiVisible = (visible: boolean): void => {
    aiVisible.current = visible
    if (visible) {
      // L'utilisateur revient sur la page IA → effacer la notification
      setState(prev => ({ ...prev, hasNotification: false }))
    }
  }

  const clearNotification = (): void => {
    setState(prev => ({ ...prev, hasNotification: false }))
  }

  const clearPendingAction = (): void => {
    setState(prev => ({ ...prev, pendingAction: null }))
  }

  return (
    <AiStreamContext.Provider value={{
      ...state,
      startStream,
      markAiVisible,
      clearNotification,
      clearPendingAction,
    }}>
      {children}
    </AiStreamContext.Provider>
  )
}
