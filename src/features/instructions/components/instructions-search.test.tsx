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

  it('valida o limite e limpa o filtro devolvendo o foco', async () => {
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
    expect(screen.getByText('Digite no máximo 200 caracteres.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(onClear).toHaveBeenCalledOnce()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
  })
})
