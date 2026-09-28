import type { MouseEvent } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { InstructionPage } from '../model/instruction'
export function InstructionsPagination({
  result,
  onPageChange,
}: {
  result: InstructionPage
  onPageChange: (page: number) => void
}) {
  const pages = Array.from(
    { length: result.totalPages },
    (_, index) => index + 1,
  ).slice(
    Math.max(0, result.page - 3),
    Math.min(result.totalPages, result.page + 2),
  )
  const navigate = (page: number) => (event: MouseEvent) => {
    event.preventDefault()
    if (page >= 1 && page <= result.totalPages && page !== result.page)
      onPageChange(page)
  }
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        {result.first} a {result.last} de {result.total} registros
      </p>
      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={navigate(result.page - 1)}
              aria-disabled={result.page === 1}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              Anterior
            </PaginationPrevious>
          </PaginationItem>
          {pages.map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={page === result.page}
                onClick={navigate(page)}
                aria-label={`Página ${page}`}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={navigate(result.page + 1)}
              aria-disabled={result.page === result.totalPages}
              className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              Próximo
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
