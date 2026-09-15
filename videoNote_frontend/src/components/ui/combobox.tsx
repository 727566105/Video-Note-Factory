import * as React from 'react'
import { Check, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// ── Context ──
interface ComboboxCtxValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  anchorRef: React.RefObject<HTMLDivElement | null>
}
const ComboboxCtx = React.createContext<ComboboxCtxValue | null>(null)
function useComboboxCtx() {
  const ctx = React.useContext(ComboboxCtx)
  if (!ctx) throw new Error('useComboboxCtx must be used inside <Combobox>')
  return ctx
}

// ── useComboboxAnchor ──
export function useComboboxAnchor() {
  return useComboboxCtx().anchorRef
}

// ── Combobox ──
export function Combobox({ children, ...props }: React.ComponentProps<typeof Popover>) {
  const [open, setOpen] = React.useState(false)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  return (
    <ComboboxCtx.Provider value={{ open, setOpen, anchorRef }}>
      <Popover open={open} onOpenChange={setOpen} {...props}>
        {children}
      </Popover>
    </ComboboxCtx.Provider>
  )
}

// ── ComboboxTrigger ──
export function ComboboxTrigger({ ...props }: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger asChild {...props} />
}

// ── ComboboxChips (container that looks like an input) ──
export function ComboboxChips({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const { setOpen, anchorRef } = useComboboxCtx()
  return (
    <div
      ref={anchorRef}
      onClick={() => setOpen(true)}
      className={cn(
        'flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background cursor-text',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ── ComboboxChip ──
export function ComboboxChip({
  onRemove,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { onRemove?: () => void }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}

// ── ComboboxChipsInput ──
export function ComboboxChipsInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  const { setOpen } = useComboboxCtx()
  return (
    <input
      onFocus={() => setOpen(true)}
      className={cn(
        'flex-1 min-w-[60px] bg-transparent outline-none placeholder:text-muted-foreground text-sm',
        className,
      )}
      {...props}
    />
  )
}

// ── ComboboxValue ──
export function ComboboxValue({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

// ── ComboboxContent ──
export function ComboboxContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { anchorRef, setOpen } = useComboboxCtx()
  return (
    <PopoverContent
      className={cn('p-0', className)}
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      style={{ width: anchorRef.current?.offsetWidth ?? 200, minWidth: 180 }}
      align="start"
      {...props}
    >
      <div className="flex flex-col overflow-hidden">{children}</div>
    </PopoverContent>
  )
}

// ── ComboboxList ──
export function ComboboxList({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('max-h-[200px] overflow-y-auto p-1', className)}
      {...props}
    >
      {children}
    </div>
  )
}

// ── ComboboxEmpty ──
export function ComboboxEmpty({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('py-6 text-center text-sm text-muted-foreground', className)} {...props}>
      {children || '无匹配结果'}
    </div>
  )
}

// ── ComboboxItem ──
export function ComboboxItem({
  selected,
  children,
  onSelect,
  className,
  ...props
}: React.ComponentProps<'div'> & { selected?: boolean; onSelect?: () => void }) {
  const { setOpen } = useComboboxCtx()
  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => {
        onSelect?.()
      }}
      className={cn(
        'relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none',
        'hover:bg-accent hover:text-accent-foreground',
        selected && 'bg-accent/50',
        className,
      )}
      {...props}
    >
      <Check
        className={cn(
          'size-4 shrink-0',
          selected ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
    </div>
  )
}