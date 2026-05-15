/// <reference types="vite/client" />

import type { AppFile, AppFolder } from './types/files'
import type { AppSettings } from './types/settings'
import type { CalendarEvent, NewCalendarEvent } from './types/calendar'
import type { AppBoard, AppBoardFull } from './types/whiteboard'

declare global {
  // ── Types IA (globaux car utilisés dans les pages renderer) ────────────────
  type AiMessage = {
    id: number
    role: 'user' | 'assistant'
    content: string
    provider: string
    model: string
    created_at: string
  }

  type AiStatus = {
    provider: 'openai' | 'anthropic' | 'ollama'
    model: string
    hasKey: boolean
  }

  type AiConversation = {
    id: number
    title: string
    created_at: string
    updated_at: string
  }

  type AiActionCreateEvent = {
    type:         'create_event'
    title:        string
    start_at:     string
    end_at:       string
    all_day:      boolean
    description?: string
    category?:    string
    color?:       string
  }

  type AiActionCreateNote = {
    type:    'create_note'
    title:   string
    content: string
  }

  type AiAction = AiActionCreateEvent | AiActionCreateNote

  type OllamaModel = {
    name:        string
    size:        number
    modified_at: string
  }

  interface Window {
    api: {
      calendar: {
        list:   (range: { from: string; to: string }) => Promise<CalendarEvent[]>
        create: (event: NewCalendarEvent)             => Promise<CalendarEvent>
        update: (id: number, event: NewCalendarEvent) => Promise<CalendarEvent>
        delete: (id: number)                          => Promise<void>
      }
      files: {
        list:         (folderId?: number)                        => Promise<AppFile[]>
        pick:         ()                                         => Promise<AppFile[]>
        open:         (filePath: string)                         => Promise<boolean>
        reveal:       (filePath: string)                         => Promise<boolean>
        move:         (id: number, folderId: number | null)      => Promise<boolean>
        delete:       (id: number)                               => Promise<boolean>
        createNote:   (title: string)                            => Promise<AppFile>
        readContent:  (id: number)                               => Promise<string>
        writeContent: (id: number, content: string)              => Promise<boolean>
        renameNote:   (id: number, newName: string)              => Promise<{ name: string; path: string } | false>
      }
      folders: {
        list:   ()                                => Promise<AppFolder[]>
        create: (name: string)                    => Promise<AppFolder>
        delete: (id: number)                      => Promise<boolean>
        rename: (id: number, name: string)        => Promise<boolean>
      }
      ai: {
        chat:    (payload: { message: string; reasoningMode: string; profile: object | null; conversationId: number }) => Promise<null>
        history: (conversationId: number) => Promise<AiMessage[]>
        clear:   (conversationId: number) => Promise<boolean>
        status:  () => Promise<AiStatus>
        onChunk:               (cb: (text: string) => void) => () => void
        onDone:                (cb: (data: { cleanContent: string; action: AiAction | null }) => void) => () => void
        onError:               (cb: (msg: string) => void)  => () => void
        onConversationUpdated: (cb: (id: number) => void)   => () => void
        conversations: {
          list:   () => Promise<AiConversation[]>
          create: () => Promise<AiConversation>
          rename: (id: number, title: string) => Promise<boolean>
          delete: (id: number) => Promise<boolean>
        }
      }
      ollama: {
        status: () => Promise<{ running: boolean; models: OllamaModel[] }>
        delete: (name: string) => Promise<boolean>
        pull:   (name: string) => Promise<null>
        onPullProgress: (cb: (data: { status: string; completed?: number; total?: number }) => void) => () => void
        onPullDone:     (cb: (name: string) => void) => () => void
        onPullError:    (cb: (msg: string) => void)  => () => void
      }
      settings: {
        get:          ()                                     => Promise<AppSettings>
        patch:        (patch: Partial<AppSettings>)          => Promise<AppSettings>
        reset:        ()                                     => Promise<AppSettings>
        hasApiKey:    (service: string)                      => Promise<boolean>
        setApiKey:    (service: string, key: string)         => Promise<boolean>
        getApiKey:    (service: string)                      => Promise<string>
        deleteApiKey: (service: string)                      => Promise<boolean>
        export:       ()                                     => Promise<boolean>
        appInfo:      () => Promise<{
          version: string; platform: string; userData: string
          electron: string; node: string
        }>
      }
      whiteboard: {
        list:   ()                               => Promise<AppBoard[]>
        create: (title: string, color: string)   => Promise<AppBoardFull>
        get:    (id: number)                     => Promise<AppBoardFull>
        save:   (id: number, data: string)       => Promise<void>
        rename: (id: number, title: string)      => Promise<void>
        delete: (id: number)                     => Promise<void>
      }
      updater: {
        onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  } // fin interface Window
} // fin declare global
