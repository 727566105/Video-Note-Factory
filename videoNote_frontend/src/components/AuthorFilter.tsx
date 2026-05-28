import { useState, useMemo } from 'react'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox'
import type { FilterOption } from '@/components/MultiSelectFilter'

interface AuthorFilterProps {
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function AuthorFilter({
  options,
  selected,
  onChange,
  placeholder = '搜索博主...',
}: AuthorFilterProps) {
  const [query, setQuery] = useState('')

  const filteredOptions = useMemo(() => {
    if (!query) return options
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query.toLowerCase())
    )
  }, [options, query])

  const handleSelect = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value],
    )
  }

  const handleRemove = (value: string) => {
    onChange(selected.filter(v => v !== value))
  }

  return (
    <Combobox>
      <ComboboxTrigger asChild>
        <ComboboxChips>
          {selected.map(value => {
            const opt = options.find(o => o.value === value)
            if (!opt) return null
            return (
              <ComboboxChip key={value} onRemove={() => handleRemove(value)}>
                {opt.label}
              </ComboboxChip>
            )
          })}
          <ComboboxChipsInput
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={selected.length === 0 ? placeholder : ''}
          />
        </ComboboxChips>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxList>
          {filteredOptions.length === 0 ? (
            <ComboboxEmpty />
          ) : (
            filteredOptions.map(option => (
              <ComboboxItem
                key={option.value}
                selected={selected.includes(option.value)}
                onSelect={() => handleSelect(option.value)}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {option.count}篇
                  </span>
                )}
              </ComboboxItem>
            ))
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}