import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstructionsSearch } from './instructions-search'

describe('InstructionsSearch', () => {
  it('normaliza a busca enviada por Enter', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<InstructionsSearch term="" onSearch={onSearch} onClear={vi.fn()} />)
    const input = screen.getByRole('searchbox', {
      name: 'Pesquisar instruções',
    })
    await user.type(input, '  mpv 001  {Enter}')
    expect(onSearch).toHaveBeenCalledWith('mpv 001')
    expect(input).toHaveValue('mpv 001')
  })

  it('associa o erro ao campo inválido e limpa o feedback ao editar', async () => {
    const user = userEvent.setup()
    render(<InstructionsSearch term="" onSearch={vi.fn()} onClear={vi.fn()} />)
    const input = screen.getByRole('searchbox', {
      name: 'Pesquisar instruções',
    })
    await user.type(input, 'a'.repeat(201))
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }))
    const error = screen.getByRole('alert')
    const field = input.closest('[data-slot="field"]')

    expect(error).toHaveTextContent('Digite no máximo 200 caracteres.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
    expect(field).toHaveAttribute('data-invalid', 'true')

    await user.type(input, 'b')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(field).toHaveAttribute('data-invalid', 'false')
  })

  it('limpa o filtro, remove o erro e devolve o foco', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <InstructionsSearch term="filtro" onSearch={vi.fn()} onClear={onClear} />,
    )
    const input = screen.getByRole('searchbox', {
      name: 'Pesquisar instruções',
    })
    await user.clear(input)
    await user.type(input, 'a'.repeat(201))
    await user.click(screen.getByRole('button', { name: 'Pesquisar' }))
    expect(screen.getByRole('alert')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onClear).toHaveBeenCalledOnce()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
