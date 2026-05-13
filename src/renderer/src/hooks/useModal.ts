import { useState } from "react"

export function useModal<T>(): {
  isOpen: boolean
  data: T | null
  open: (data: T) => void
  close: () => void
} {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<T | null>(null)

  const open = (data: T): void => {
    setData(data)
    setIsOpen(true)
  }
  const close = (): void => {
    setIsOpen(false)
    setData(null)
  }

  return { isOpen, data, open, close }
}