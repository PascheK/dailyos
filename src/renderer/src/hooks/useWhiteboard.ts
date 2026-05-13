import { useState, useCallback } from 'react'
import type { AppBoard, AppBoardFull } from '../types/whiteboard'

export function useWhiteboard(): {
  boards: AppBoard[]
  loadBoards: () => Promise<void>
  createBoard: (title: string, color: string) => Promise<AppBoardFull>
  getBoard: (id: number) => Promise<AppBoardFull>
  saveBoard: (id: number, data: string) => Promise<void>
  renameBoard: (id: number, title: string) => Promise<void>
  deleteBoard: (id: number) => Promise<void>
} {
  const [boards, setBoards] = useState<AppBoard[]>([])

  const loadBoards = useCallback(async () => {
    const data = await window.api.whiteboard.list()
    setBoards(data)
  }, [])

  const createBoard = useCallback(async (title: string, color: string): Promise<AppBoardFull> => {
    const board = await window.api.whiteboard.create(title, color)
    setBoards((prev) => [board, ...prev])
    return board
  }, [])

  const getBoard = useCallback(async (id: number): Promise<AppBoardFull> => {
    return window.api.whiteboard.get(id)
  }, [])

  const saveBoard = useCallback(async (id: number, data: string) => {
    await window.api.whiteboard.save(id, data)
  }, [])

  const renameBoard = useCallback(async (id: number, title: string) => {
    await window.api.whiteboard.rename(id, title)
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, title } : b)))
  }, [])

  const deleteBoard = useCallback(async (id: number) => {
    await window.api.whiteboard.delete(id)
    setBoards((prev) => prev.filter((b) => b.id !== id))
  }, [])

  return { boards, loadBoards, createBoard, getBoard, saveBoard, renameBoard, deleteBoard }
}
