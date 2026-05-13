import { contextBridge, ipcRenderer } from 'electron'

const api = {
  calendar: {
    list: (range: { from: string; to: string }) => ipcRenderer.invoke('calendar:list', range),
    create: (event: unknown) => ipcRenderer.invoke('calendar:create', event),
    delete: (id: number) => ipcRenderer.invoke('calendar:delete', id),
    update: (id: number, event: unknown) =>
      ipcRenderer.invoke('calendar:update', { id, ...(event as object) })
  },
  files: {
    list:         (folderId?: number)                    => ipcRenderer.invoke('files:list', folderId),
    pick:         ()                                     => ipcRenderer.invoke('files:pick'),
    open:         (filePath: string)                     => ipcRenderer.invoke('files:open', filePath),
    reveal:       (filePath: string)                     => ipcRenderer.invoke('files:reveal', filePath),
    move:         (id: number, folderId: number | null)  => ipcRenderer.invoke('files:move', { id, folderId }),
    delete:       (id: number)                           => ipcRenderer.invoke('files:delete', id),
    // Notes .md gérées par l'app
    createNote:   (title: string)                        => ipcRenderer.invoke('files:createNote', title),
    readContent:  (id: number)                           => ipcRenderer.invoke('files:readContent', id),
    writeContent: (id: number, content: string)          => ipcRenderer.invoke('files:writeContent', { id, content }),
    renameNote:   (id: number, newName: string)          => ipcRenderer.invoke('files:renameNote', { id, newName })
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (name: string) => ipcRenderer.invoke('folders:create', name),
    delete: (id: number) => ipcRenderer.invoke('folders:delete', id),
    rename: (id: number, name: string) => ipcRenderer.invoke('folders:rename', { id, name })
  },
  whiteboard: {
    list:   ()                                        => ipcRenderer.invoke('whiteboard:list'),
    create: (title: string, color: string)            => ipcRenderer.invoke('whiteboard:create', { title, color }),
    get:    (id: number)                              => ipcRenderer.invoke('whiteboard:get', id),
    save:   (id: number, data: string)                => ipcRenderer.invoke('whiteboard:save', { id, data }),
    rename: (id: number, title: string)               => ipcRenderer.invoke('whiteboard:rename', { id, title }),
    delete: (id: number)                              => ipcRenderer.invoke('whiteboard:delete', id)
  },
  ai: {
    chat:    (payload: object)            => ipcRenderer.invoke('ai:chat', payload),
    history: (conversationId: number)     => ipcRenderer.invoke('ai:history', conversationId),
    clear:   (conversationId: number)     => ipcRenderer.invoke('ai:clear', conversationId),
    status:  ()                           => ipcRenderer.invoke('ai:status'),
    // Listeners streaming (retournent une fonction de nettoyage)
    onChunk: (cb: (text: string) => void) => {
      const handler = (_: unknown, text: string): void => cb(text)
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.removeListener('ai:chunk', handler)
    },
    onDone: (cb: (data: { cleanContent: string; action: object | null }) => void) => {
      const handler = (_: unknown, data: { cleanContent: string; action: object | null }): void => cb(data)
      ipcRenderer.on('ai:done', handler)
      return () => ipcRenderer.removeListener('ai:done', handler)
    },
    onError: (cb: (msg: string) => void) => {
      const handler = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('ai:error', handler)
      return () => ipcRenderer.removeListener('ai:error', handler)
    },
    onConversationUpdated: (cb: (id: number) => void) => {
      const handler = (_: unknown, id: number): void => cb(id)
      ipcRenderer.on('ai:conversation:updated', handler)
      return () => ipcRenderer.removeListener('ai:conversation:updated', handler)
    },
    conversations: {
      list:   ()                                          => ipcRenderer.invoke('ai:conversations:list'),
      create: ()                                          => ipcRenderer.invoke('ai:conversations:create'),
      rename: (id: number, title: string)                 => ipcRenderer.invoke('ai:conversations:rename', { id, title }),
      delete: (id: number)                                => ipcRenderer.invoke('ai:conversations:delete', id),
    }
  },
  ollama: {
    status: () => ipcRenderer.invoke('ollama:status'),
    delete: (name: string) => ipcRenderer.invoke('ollama:delete', name),
    pull:   (name: string) => ipcRenderer.invoke('ollama:pull', name),
    onPullProgress: (cb: (data: { status: string; completed?: number; total?: number }) => void) => {
      const h = (_: unknown, data: { status: string; completed?: number; total?: number }): void => cb(data)
      ipcRenderer.on('ollama:pull:progress', h)
      return () => ipcRenderer.removeListener('ollama:pull:progress', h)
    },
    onPullDone: (cb: (name: string) => void) => {
      const h = (_: unknown, name: string): void => cb(name)
      ipcRenderer.on('ollama:pull:done', h)
      return () => ipcRenderer.removeListener('ollama:pull:done', h)
    },
    onPullError: (cb: (msg: string) => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('ollama:pull:error', h)
      return () => ipcRenderer.removeListener('ollama:pull:error', h)
    }
  },
  settings: {
    get:          ()                                          => ipcRenderer.invoke('settings:get'),
    patch:        (patch: object)                             => ipcRenderer.invoke('settings:patch', patch),
    reset:        ()                                          => ipcRenderer.invoke('settings:reset'),
    hasApiKey:    (service: string)                           => ipcRenderer.invoke('settings:hasApiKey', service),
    setApiKey:    (service: string, key: string)              => ipcRenderer.invoke('settings:setApiKey', { service, key }),
    getApiKey:    (service: string)                           => ipcRenderer.invoke('settings:getApiKey', service),
    deleteApiKey: (service: string)                           => ipcRenderer.invoke('settings:deleteApiKey', service),
    export:       ()                                          => ipcRenderer.invoke('settings:export'),
    appInfo:      ()                                          => ipcRenderer.invoke('settings:appInfo'),
  }
}

contextBridge.exposeInMainWorld('api', api)
