import { useState, useCallback } from 'react'
import type { AppFile, AppFolder } from '../types/files'

export function useFiles(): {
  files: AppFile[]
  folders: AppFolder[]
  loadFiles: () => Promise<void>
  loadFolders: () => Promise<void>
  pickAndAdd: (folderId?: number) => Promise<void>
  openFile: (path: string) => Promise<void>
  revealFile: (path: string) => Promise<void>
  moveFile: (id: number, folderId: number | null) => Promise<void>
  deleteFile: (id: number) => Promise<void>
  renameFile: (id: number, newName: string) => Promise<boolean>
  createNote: (title: string, folderId?: number) => Promise<AppFile>
  createFolder: (name: string, color?: string) => Promise<AppFolder>
  deleteFolder: (id: number) => Promise<void>
  renameFolder: (id: number, name: string) => Promise<boolean>
  setFolderColor: (id: number, color: string | null) => Promise<void>
  reorderFolders: (orderedIds: number[]) => Promise<void>
} {
  const [files,   setFiles]   = useState<AppFile[]>([])
  const [folders, setFolders] = useState<AppFolder[]>([])

  // Charge TOUS les fichiers — le filtrage par dossier est fait côté client
  const loadFiles = useCallback(async () => {
    const data = await window.api.files.list()
    setFiles(data)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await window.api.folders.list()
    setFolders(data)
  }, [])

  const pickAndAdd = useCallback(async (folderId?: number) => {
    const added = await window.api.files.pick()
    if (added.length === 0) return
    if (folderId !== undefined) {
      await Promise.all(added.map((f) => window.api.files.move(f.id, folderId)))
    }
    await loadFiles()
  }, [loadFiles])

  const openFile = useCallback(async (path: string) => {
    await window.api.files.open(path)
  }, [])

  const revealFile = useCallback(async (path: string) => {
    await window.api.files.reveal(path)
  }, [])

  const moveFile = useCallback(async (id: number, folderId: number | null) => {
    await window.api.files.move(id, folderId)
    setFiles((prev) => prev.map((f) =>
      f.id === id ? { ...f, folder_id: folderId, folder: null } : f
    ))
    loadFiles()
  }, [loadFiles])

  const deleteFile = useCallback(async (id: number) => {
    await window.api.files.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const renameFile = useCallback(async (id: number, newName: string): Promise<boolean> => {
    const result = await window.api.files.renameNote(id, newName)
    if (result) {
      setFiles((prev) => prev.map((f) =>
        f.id === id ? { ...f, name: result.name, path: result.path } : f
      ))
      return true
    }
    return false
  }, [])

  const createNote = useCallback(async (title: string, folderId?: number): Promise<AppFile> => {
    const file = await window.api.files.createNote(title) as AppFile
    if (folderId !== undefined) {
      await window.api.files.move(file.id, folderId)
    }
    await loadFiles()
    return { ...file, folder_id: folderId ?? null }
  }, [loadFiles])

  const createFolder = useCallback(async (name: string, color?: string): Promise<AppFolder> => {
    const folder = await window.api.folders.create(name, color)
    setFolders((prev) => [...prev, folder].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    return folder
  }, [])

  const deleteFolder = useCallback(async (id: number) => {
    await window.api.folders.delete(id)
    setFolders((prev) => prev.filter((f) => f.id !== id))
    setFiles((prev) => prev.map((f) =>
      f.folder_id === id ? { ...f, folder_id: null, folder: null } : f
    ))
  }, [])

  const renameFolder = useCallback(async (id: number, name: string): Promise<boolean> => {
    const ok = await window.api.folders.rename(id, name)
    if (ok) setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f))
    return ok
  }, [])

  const setFolderColor = useCallback(async (id: number, color: string | null) => {
    await window.api.folders.setColor(id, color)
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, color } : f))
  }, [])

  const reorderFolders = useCallback(async (orderedIds: number[]) => {
    await window.api.folders.reorder(orderedIds)
    setFolders((prev) => {
      const map = new Map(prev.map((f) => [f.id, f]))
      return orderedIds
        .filter((id) => map.has(id))
        .map((id, idx) => ({ ...map.get(id)!, sort_order: idx }))
    })
  }, [])

  return {
    files, folders,
    loadFiles, loadFolders,
    pickAndAdd, openFile, revealFile, moveFile, deleteFile, renameFile, createNote,
    createFolder, deleteFolder, renameFolder, setFolderColor, reorderFolders,
  }
}
