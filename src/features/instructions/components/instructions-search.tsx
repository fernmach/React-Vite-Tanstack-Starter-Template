import { useRef, useState, type FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function InstructionsSearch({
  term,
  onSearch,
  onClear,
}: {
  term: string
  onSearch: (term: string) => void
  onClear: () => void
}) {
  const [value, setValue] = useState(term)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = value.trim()
    if (normalized.length > 200) {
      setError('Digite no máximo 200 caracteres.')
      return
    }
    setError('')
    setValue(normalized)
    onSearch(normalized)
  }
  function clear() {
    setValue('')
    setError('')
    onClear()
    inputRef.current?.focus()
  }
  return (
    <form
      onSubmit={submit}
      className="border-border bg-card mt-5 rounded-sm border p-3"
      noValidate
    >
      <FieldGroup className="gap-3 sm:flex-row sm:items-start">
        <Field data-invalid={Boolean(error)} className="min-w-0 flex-1 gap-1">
          <FieldLabel htmlFor="instructions-search" className="sr-only">
            Pesquisar instruções
          </FieldLabel>
          <Input
            ref={inputRef}
            id="instructions-search"
            type="search"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError('')
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'instructions-search-error' : undefined}
          />
          {error && (
            <FieldError id="instructions-search-error">{error}</FieldError>
          )}
        </Field>
        <Button type="submit" size="sm">
          <Search data-icon="inline-start" aria-hidden="true" />
          Pesquisar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clear}>
          <X data-icon="inline-start" aria-hidden="true" />
          Limpar
        </Button>
      </FieldGroup>
    </form>
  )
}
