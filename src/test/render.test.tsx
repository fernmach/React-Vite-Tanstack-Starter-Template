import { useQueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { render, renderHook, screen } from './render'

function CacheValue() {
  const queryClient = useQueryClient()
  return <span>{queryClient.getQueryData<string>(['value']) ?? 'empty'}</span>
}

describe('shared test render utilities', () => {
  it('renders components with an isolated Query client', () => {
    const first = render(<CacheValue />)
    first.queryClient.setQueryData(['value'], 'first')
    first.rerender(<CacheValue />)
    expect(screen.getByText('first')).toBeInTheDocument()
    first.unmount()

    const second = render(<CacheValue />)
    expect(second.queryClient).not.toBe(first.queryClient)
    expect(screen.getByText('empty')).toBeInTheDocument()
  })

  it('renders hooks with the returned Query client', () => {
    const rendered = renderHook(() => useQueryClient())
    expect(rendered.result.current).toBe(rendered.queryClient)
  })
})
