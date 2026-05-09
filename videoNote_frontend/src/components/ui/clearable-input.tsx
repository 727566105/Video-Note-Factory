import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

const ClearableInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(({ className, value, onChange, disabled, ...props }, ref) => {
  const showClear = value != null && String(value).length > 0 && !disabled

  return (
    <div className="relative flex items-center">
      <Input
        ref={ref}
        className={cn(showClear && 'pr-8', className)}
        value={value}
        onChange={onChange}
        disabled={disabled}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          className="absolute right-2 text-neutral-400 hover:text-neutral-600"
          onClick={() => {
            const event = Object.create(null)
            event.target = { value: '' }
            event.currentTarget = { value: '' }
            onChange?.(event as React.ChangeEvent<HTMLInputElement>)
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
})

export { ClearableInput }
