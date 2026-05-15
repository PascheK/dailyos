import { ElectronAPI } from '@electron-toolkit/preload'
import type { CalendarEvent, NewCalendarEvent } from '../renderer/src/types/calendar'
import type { AppFile, AppFolder } from '../renderer/src/types/files'
import type { AppBoard, AppBoardFull } from '../renderer/src/types/whiteboard'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      calendar: {
        list: (range: { from: string; to: string }) => Promise<CalendarEvent[]>
        create: (event: NewCalendarEvent) => Promise<CalendarEvent>
        update: (id: number, event: NewCalendarEvent) => Promise<CalendarEvent>
        delete: (id: number) => Promise<unknown>
      }
      files: {
        list: (folderId?: number) => Promise<AppFile[]>
        pick: () => Promise<AppFile[]>
        open: (filePath: string) => Promise<boolean>
        reveal: (filePath: string) => Promise<boolean>
        move: (id: number, folderId: number | null) => Promise<boolean>
        delete: (id: number) => Promise<boolean>
      }
      folders: {
        list: () => Promise<AppFolder[]>
        create: (name: string) => Promise<AppFolder>
        delete: (id: number) => Promise<boolean>
        rename: (id: number, name: string) => Promise<boolean>
      }
      whiteboard: {
        list:   ()                               => Promise<AppBoard[]>
        create: (title: string, color: string)   => Promise<AppBoardFull>
        get:    (id: number)                     => Promise<AppBoardFull>
        save:   (id: number, data: string)       => Promise<boolean>
        rename: (id: number, title: string)      => Promise<boolean>
        delete: (id: number)                     => Promise<boolean>
      }
      updater: {
        onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
      }
      shell: {
        openExternal: (url: string) => Promise<void>
      }
    }
  }
}
