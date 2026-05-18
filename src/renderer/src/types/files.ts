export type AppFile = {
  id: number
  name: string
  path: string
  size: number
  mime_type: string
  folder_id: number | null
  folder: string | null   // nom du dossier via JOIN (null = pas de dossier)
  created_at: string
}

export type AppFolder = {
  id: number
  name: string
  color: string | null
  sort_order: number
  created_at: string
}
