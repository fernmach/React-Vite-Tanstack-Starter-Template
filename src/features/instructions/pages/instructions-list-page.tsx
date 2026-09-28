import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { normalizeApiError } from '@/lib/api-error'
import { useInstructions } from '../api/get-instructions'
import { InstructionCard } from '../components/instruction-card'
import { InstructionsPagination } from '../components/instructions-pagination'
import { InstructionsResults } from '../components/instructions-results'
import { InstructionsSearch } from '../components/instructions-search'

const DEFAULT_PAGE_SIZE = 20

export function InstructionsListPage() {
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [announcement, setAnnouncement] = useState('')
  const actionAnnouncementRef = useRef(false)
  const instructionsQuery = useInstructions({
    input: { term, page, pageSize: DEFAULT_PAGE_SIZE },
  })

  useEffect(() => {
    if (!instructionsQuery.data || actionAnnouncementRef.current) return

    setAnnouncement(
      `${instructionsQuery.data.total} resultados encontrados. Página ${instructionsQuery.data.page} de ${instructionsQuery.data.totalPages}.`,
    )
  }, [instructionsQuery.data])

  const result = instructionsQuery.data ?? null
  const error = instructionsQuery.error
    ? normalizeApiError(instructionsQuery.error)
    : null
  const announceAction = (message: string) => {
    actionAnnouncementRef.current = true
    setAnnouncement(message)
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-primary text-2xl font-semibold tracking-tight">
          Instruções de Montagem de MPV
        </h1>
        <Button
          variant="link"
          render={<a href="/instrucoes/nova" />}
          className="self-start sm:self-auto"
        >
          <Plus data-icon="inline-start" aria-hidden="true" />
          Nova Instrução
        </Button>
      </div>
      <InstructionsSearch
        term={term}
        onSearch={(next) => {
          actionAnnouncementRef.current = false
          if (next === term && page === 1) void instructionsQuery.refetch()
          setTerm(next)
          setPage(1)
        }}
        onClear={() => {
          actionAnnouncementRef.current = false
          if (term === '' && page === 1) void instructionsQuery.refetch()
          setTerm('')
          setPage(1)
        }}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <section aria-label="Lista de instruções" className="mt-4">
        <InstructionsResults
          loading={instructionsQuery.isPending}
          error={error}
          result={result}
          onRetry={() => void instructionsQuery.refetch()}
          onAnnounce={announceAction}
        />
        {!instructionsQuery.isPending && !error && result && (
          <div className="md:hidden">
            {result.items.map((item) => (
              <InstructionCard
                key={item.id}
                instruction={item}
                onAnnounce={announceAction}
              />
            ))}
          </div>
        )}
      </section>
      {!instructionsQuery.isPending && !error && result && (
        <InstructionsPagination
          result={result}
          onPageChange={(nextPage) => {
            actionAnnouncementRef.current = false
            setPage(nextPage)
          }}
        />
      )}
    </main>
  )
}
