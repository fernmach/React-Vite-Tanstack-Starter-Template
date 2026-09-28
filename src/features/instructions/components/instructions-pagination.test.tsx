import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstructionsPagination } from './instructions-pagination'
import type { InstructionPage } from '../model/instruction'

const result: InstructionPage = {
  items: [],
  page: 2,
  pageSize: 20,
  total: 45,
  first: 21,
  last: 40,
  totalPages: 3,
}

describe('InstructionsPagination', () => {
  it('mostra o intervalo real e navega entre páginas', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <InstructionsPagination result={result} onPageChange={onPageChange} />,
    )
    expect(screen.getByText('21 a 40 de 45 registros')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await user.click(screen.getByRole('link', { name: 'Próxima página' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('expõe e bloqueia controles indisponíveis', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <InstructionsPagination
        result={{ ...result, page: 1, first: 1, last: 20 }}
        onPageChange={onPageChange}
      />,
    )
    const previous = screen.getByRole('link', { name: 'Página anterior' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    await user.click(previous)
    expect(onPageChange).not.toHaveBeenCalled()
  })
})
