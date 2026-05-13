import { useState, useCallback } from 'react'
import type { AppFile, AppFolder } from '../types/files'

export function useFiles(): {
  files: AppFile[]
  folders: AppFolder[]
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

  const loadFiles = useCallback(async (folderId?: number) => {
    const data = await window.api.files.list(folderId)
    setFiles(data)
  }, [])

  const loadFolders = useCallback(async () => {
    const data = await window.api.folders.list()
    setFolders(data)
  }, [])

  const pickAndAdd = useCallback(async (folderId?: number) => {
    const added = await window.api.files.pick()
    if (added.length === 0) return
    await loadFiles(folderId)
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
  }, [])

  const deleteFile = useCallback(async (id: number) => {
    await window.api.files.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
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
  }, [])

  return {
    files, folders,
    loadFiles, loadFolders,
    pickAndAdd, openFile, revealFile, moveFile, deleteFile,
    createFolder, deleteFolder
  }
}
