import { useState } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

interface MultiSelectFilterProps {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  searchable?: boolean
  className?: string
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  const handleClear = (e: React.MouseEvent, value: string) => {
    e.stopPropagation()
    onChange(selected.filter(v => v !== value))
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1 text-xs',
              selected.length > 0 && 'border-primary text-primary'
            )}
          >
            {label}
            {selected.length > 0 && (
              <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium">
                {selected.length}
              </span>
            )}
            <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            {searchable && (
              <CommandInput placeholder={`搜索${label}...`} />
            )}
            <CommandList>
              <CommandEmpty>无匹配结果</CommandEmpty>
              <CommandGroup>
                {options.map(option => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5',
                        selected.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {option.count}篇
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.map(value => {
        const option = options.find(o => o.value === value)
        if (!option) return null
        return (
          <Badge
            key={value}
            variant="secondary"
            className="gap-1 text-[10px] h-6 px-1.5 cursor-pointer"
            onClick={(e) => handleClear(e, value)}
          >
            {option.label}
            <X className="h-2.5 w-2.5" />
          </Badge>
        )
      })}
    </div>
  )
}
