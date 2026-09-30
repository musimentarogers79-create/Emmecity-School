import { useId, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  testId?: string;
};

const optionSearchValue = (option: SearchableOption) =>
  [option.label, option.keywords, option.value].filter(Boolean).join(' ');

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = 'Search options…',
  emptyText = 'No options found.',
  clearLabel,
  disabled = false,
  loading = false,
  required = false,
  ariaLabel,
  className,
  testId,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const listId = `${testId || generatedId}-options`;
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-required={required || undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'focus-ring flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          data-testid={testId}
        >
          <span className={cn('min-w-0 flex-1 truncate', !selected && !value && 'text-[hsl(var(--muted-foreground))]')}>
            {selected?.label || (value ? 'Selected option' : placeholder)}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            autoFocus
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={testId ? `${testId}-search` : undefined}
          />
          <CommandList id={listId}>
            <CommandEmpty>{loading ? 'Loading options…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {clearLabel && value && (
                <CommandItem
                  value={`clear selection ${clearLabel}`}
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                  data-testid={testId ? `${testId}-clear` : undefined}
                >
                  <Check className={cn('size-4', value ? 'opacity-0' : 'opacity-100')} aria-hidden="true" />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={`${option.value}:${option.label}`}
                  value={optionSearchValue(option)}
                  disabled={option.disabled}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                >
                  <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type SearchableMultiSelectProps = {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: SearchableOption[];
  placeholder: string;
  selectedLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
  testId?: string;
};

export function SearchableMultiSelect({
  value,
  onValueChange,
  options,
  placeholder,
  selectedLabel = 'selected',
  searchPlaceholder = 'Search options…',
  emptyText = 'No options found.',
  clearLabel = 'Clear selection',
  disabled = false,
  loading = false,
  required = false,
  ariaLabel,
  className,
  testId,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const generatedId = useId();
  const listId = `${testId || generatedId}-options`;
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const selectedValues = new Set(value);
  const summary = selectedOptions.length === 1
    ? selectedOptions[0].label
    : `${value.length} ${selectedLabel}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-required={required || undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'focus-ring flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          data-testid={testId}
        >
          <span className={cn('min-w-0 flex-1 truncate', !value.length && 'text-[hsl(var(--muted-foreground))]')}>
            {value.length ? summary : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            autoFocus
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={testId ? `${testId}-search` : undefined}
          />
          <CommandList id={listId}>
            <CommandEmpty>{loading ? 'Loading options…' : emptyText}</CommandEmpty>
            <CommandGroup>
              {value.length > 0 && (
                <CommandItem
                  value={`clear all ${clearLabel}`}
                  onSelect={() => onValueChange([])}
                  data-testid={testId ? `${testId}-clear` : undefined}
                >
                  <Check className="size-4 opacity-0" aria-hidden="true" />
                  {clearLabel}
                </CommandItem>
              )}
              {options.map((option) => {
                const selected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={`${option.value}:${option.label}`}
                    value={optionSearchValue(option)}
                    disabled={option.disabled}
                    onSelect={() => onValueChange(
                      selected ? value.filter((item) => item !== option.value) : [...value, option.value],
                    )}
                    data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                  >
                    <Check className={cn('size-4', selected ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}