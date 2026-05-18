import { useState, useCallback } from 'react'
import type { AppFile, AppFolder } from '../types/files'

export function useFiles(): {
  files: AppFile[]
  folders: AppFolder[]
  totalCount: number
  loadFiles: (folderId?: number) => Promise<void>
  loadFolders: () => Promise<void>
  pickAndAdd: (folderId?: number) => Promise<void>
  openFile: (path: string) => Promise<void>
  revealFile: (path: string) => Promise<void>
  moveFile: (id: number, folderId: number | null) => Promise<void>
  deleteFile: (id: number) => Promise<void>
  createFolder: (name: string) => Promise<AppFolder>
  deleteFolder: (id: number) => Promise<void>
} {
  const [files, setFiles] = useState<AppFile[]>([])
  const [folders, setFolders] = useState<AppFolder[]>([])
  // Nombre total de fichiers, indépendant du dossier sélectionné
  const [totalCount, setTotalCount] = useState(0)

  const loadFiles = useCallback(async (folderId?: number) => {
    const data = await window.api.files.list(folderId)
    setFiles(data)
    // Quand on charge TOUS les fichiers, on met à jour le total
    if (folderId === undefined) setTotalCount(data.length)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await window.api.folders.list()
    setFolders(data)
  }, [])

  const pickAndAdd = useCallback(async (folderId?: number) => {
    const added = await window.api.files.pick()
    if (added.length === 0) return
    await loadFiles(folderId)
    // Rafraîchir le total si on a ajouté dans un dossier
    if (folderId !== undefined) {
      window.api.files.list().then((all) => setTotalCount(all.length))
    }
  }, [loadFiles])

  const openFile = useCallback(async (path: string) => {
    await window.api.files.open(path)
  }, [])

  const revealFile = useCallback(async (path: string) => {
    await window.api.files.reveal(path)
  }, [])

  const moveFile = useCallback(async (id: number, folderId: number | null) => {
    await window.api.files.move(id, folderId)
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, folder_id: folderId } : f)))
    // moveFile ne change pas le nombre total
  }, [])

  const deleteFile = useCallback(async (id: number) => {
    await window.api.files.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
    setTotalCount((n) => Math.max(0, n - 1))
  }, [])

  const createFolder = useCallback(async (name: string): Promise<AppFolder> => {
    const folder = await window.api.folders.create(name)
    setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
    return folder
  }, [])

  const deleteFolder = useCallback(async (id: number) => {
    await window.api.folders.delete(id)
    setFolders((prev) => prev.filter((f) => f.id !== id))
    // Les fichiers orphelins (folder_id devient null) restent visibles dans "Tous"
    setFiles((prev) => prev.map((f) => (f.folder_id === id ? { ...f, folder_id: null, folder: null } : f)))
    // Le total ne change pas : les fichiers existent toujours, juste dé-classés
  }, [])

  return {
    files, folders, totalCount,
    loadFiles, loadFolders,
    pickAndAdd, openFile, revealFile, moveFile, deleteFile,
    createFolder, deleteFolder
  }
}
