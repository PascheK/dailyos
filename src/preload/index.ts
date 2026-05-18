import { contextBridge, ipcRenderer, shell } from 'electron'

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
    list:     ()                                         => ipcRenderer.invoke('folders:list'),
    create:   (name: string, color?: string)             => ipcRenderer.invoke('folders:create', { name, color }),
    delete:   (id: number)                               => ipcRenderer.invoke('folders:delete', id),
    rename:   (id: number, name: string)                 => ipcRenderer.invoke('folders:rename', { id, name }),
    setColor: (id: number, color: string | null)         => ipcRenderer.invoke('folders:setColor', { id, color }),
    reorder:  (ids: number[])                            => ipcRenderer.invoke('folders:reorder', ids),
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
  updater: {
    checkNow: () => ipcRenderer.invoke('updater:check'),
    download:  (version: string) => ipcRenderer.invoke('updater:download', version),
    onUpdateAvailable: (cb: (info: { version: string }) => void) => {
      const handler = (_: unknown, info: { version: string }): void => cb(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onUpdateNotAvailable: (cb: () => void) => {
      const handler = (): void => cb()
      ipcRenderer.on('update:not-available', handler)
      return () => ipcRenderer.removeListener('update:not-available', handler)
    },
    onDownloadProgress: (cb: (data: { progress: number; received: number; total: number }) => void) => {
      const h = (_: unknown, data: { progress: number; received: number; total: number }): void => cb(data)
      ipcRenderer.on('updater:download:progress', h)
      return () => ipcRenderer.removeListener('updater:download:progress', h)
    },
    onDownloadDone: (cb: (data: { filePath: string }) => void) => {
      const h = (_: unknown, data: { filePath: string }): void => cb(data)
      ipcRenderer.on('updater:download:done', h)
      return () => ipcRenderer.removeListener('updater:download:done', h)
    },
    onDownloadError: (cb: (msg: string) => void) => {
      const h = (_: unknown, msg: string): void => cb(msg)
      ipcRenderer.on('updater:download:error', h)
      return () => ipcRenderer.removeListener('updater:download:error', h)
    },
  },
  budget: {
    list:            ()                             => ipcRenderer.invoke('budget:list'),
    create:          (p: object)                    => ipcRenderer.invoke('budget:create', p),
    update:          (p: object)                    => ipcRenderer.invoke('budget:update', p),
    delete:          (id: number)                   => ipcRenderer.invoke('budget:delete', id),
    summary:         (id: number)                   => ipcRenderer.invoke('budget:summary', id),
    widgetData:      ()                             => ipcRenderer.invoke('budget:widgetData'),
    addTransaction:  (p: object)                    => ipcRenderer.invoke('budget:transactions:add', p),
    listTransactions:(id: number)                   => ipcRenderer.invoke('budget:transactions:list', id),
    deleteTransaction:(id: number)                  => ipcRenderer.invoke('budget:transactions:delete', id),
    addExtra:        (p: object)                    => ipcRenderer.invoke('budget:extras:add', p),
    listExtras:      (id: number)                   => ipcRenderer.invoke('budget:extras:list', id),
    deleteExtra:     (id: number)                   => ipcRenderer.invoke('budget:extras:delete', id),
    listCategories:  (budgetId?: number)            => ipcRenderer.invoke('budget:categories:list', budgetId),
    createCategory:  (p: object)                    => ipcRenderer.invoke('budget:categories:create', p),
    deleteCategory:  (id: number)                   => ipcRenderer.invoke('budget:categories:delete', id),
    listRecurring:   (id: number)                   => ipcRenderer.invoke('budget:recurring:list', id),
    createRecurring: (p: object)                    => ipcRenderer.invoke('budget:recurring:create', p),
    toggleRecurring: (id: number)                   => ipcRenderer.invoke('budget:recurring:toggle', id),
    deleteRecurring: (id: number)                   => ipcRenderer.invoke('budget:recurring:delete', id),
    applyRecurring:  (id: number)                   => ipcRenderer.invoke('budget:recurring:apply', id),
    getGoal:         (id: number)                   => ipcRenderer.invoke('budget:goals:get', id),
    recalculateGoal: (id: number)                   => ipcRenderer.invoke('budget:goals:recalculate', id),
    aiAnalysis:      (id: number)                   => ipcRenderer.invoke('budget:goals:aiAnalysis', id),
    refreshRate:     (id: number)                   => ipcRenderer.invoke('budget:rate:refresh', id),
    listCategoryLimits: (budgetId: number)          => ipcRenderer.invoke('budget:categoryLimits:list', budgetId),
    setCategoryLimit:   (p: object)                 => ipcRenderer.invoke('budget:categoryLimits:set', p),
    deleteCategoryLimit:(p: object)                 => ipcRenderer.invoke('budget:categoryLimits:delete', p),
    categorySpending:   (budgetId: number)          => ipcRenderer.invoke('budget:categorySpending', budgetId),
    wizardStart:        (p: object)                 => ipcRenderer.invoke('budget:wizard:start', p),
    onWizardChunk: (cb: (chunk: string) => void) => {
      const h = (_: unknown, chunk: string): void => cb(chunk)
      ipcRenderer.on('budget:wizard:chunk', h)
      return () => ipcRenderer.removeListener('budget:wizard:chunk', h)
    },
    onWizardDone: (cb: (data: { budgetId: number }) => void) => {
      const h = (_: unknown, data: { budgetId: number }): void => cb(data)
      ipcRenderer.on('budget:wizard:done', h)
      return () => ipcRenderer.removeListener('budget:wizard:done', h)
    },
    checkupDetail:      (budgetId: number, month: string) => ipcRenderer.invoke('budget:checkup:detail', { budgetId, month }),
    acknowledgeCheckup: (id: number)                      => ipcRenderer.invoke('budget:checkup:acknowledge', id),
    monthlyData:        (budgetId: number)                => ipcRenderer.invoke('budget:monthlyData', budgetId),
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
    resetAll:     ()                                          => ipcRenderer.invoke('settings:resetAll'),
    appInfo:      ()                                          => ipcRenderer.invoke('settings:appInfo'),
  }
}

contextBridge.exposeInMainWorld('api', {
  ...api,
  shell: {
    openExternal: (url: string) => shell.openExternal(url)
  }
})
