export type AppBoard = {
  id: number
  title: string
  color: string
  created_at: string
  updated_at: string
}

// Board complet avec le JSON Excalidraw
export type AppBoardFull = AppBoard & {
  data: string
}
