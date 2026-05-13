import { useRef, useEffect } from 'react'

type Props = {
  items: string[]
  value: string
  onChange: (value: string) => void
}

const ITEM_HEIGHT = 44

export function ScrollPicker({ items, value, onChange }: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const selectedIndex = items.indexOf(value)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = selectedIndex * ITEM_HEIGHT
    }
  }, [])

  const handleScroll = (): void => {
    if (!ref.current) return
    const index = Math.round(ref.current.scrollTop / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(index, items.length - 1))
    if (items[clamped] !== value) onChange(items[clamped])
  }

  return (
    <div className="relative w-20 h-[220px] overflow-hidden select-none">
      {/* Gradients haut et bas */}
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none" />

      {/* Ligne de sélection centrale */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-11 border-y border-slate-600/60 z-10 pointer-events-none" />

      {/* Liste scrollable */}
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        {/* Padding haut */}
        <div style={{ height: (220 - ITEM_HEIGHT) / 2 }} />

        {items.map((item) => (
          <div
            key={item}
            style={{ scrollSnapAlign: 'center', height: ITEM_HEIGHT }}
            className="flex items-center justify-center text-lg font-semibold text-white cursor-pointer"
            onClick={() => onChange(item)}
          >
            {item}
          </div>
        ))}

        {/* Padding bas */}
        <div style={{ height: (220 - ITEM_HEIGHT) / 2 }} />
      </div>
    </div>
  )
}