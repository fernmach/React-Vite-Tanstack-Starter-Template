import { describe, expect, it } from 'vitest'
import {
  authRedirectOrDefault,
  DEFAULT_AUTH_REDIRECT,
  safeAuthRedirect,
} from './redirect'

describe('safe authentication redirects', () => {
  it.each([
    ['/instrucoes', '/instrucoes'],
    [
      '/instrucoes?busca=solado%20azul#resultado-4',
      '/instrucoes?busca=solado%20azul#resultado-4',
    ],
    [
      '/instrucoes/nova?origem=lista#formulario',
      '/instrucoes/nova?origem=lista#formulario',
    ],
  ])('preserves a safe same-origin destination', (value, expected) => {
    expect(safeAuthRedirect(value)).toBe(expected)
  })

  it.each([
    'https://evil.example/roubo',
    '//evil.example/roubo',
    '/\\evil.example/roubo',
    '\\evil.example\\roubo',
    '/%5cevil.example/roubo',
    '/%2f%2fevil.example/roubo',
    '/instrucoes%0d%0aLocation:%20https://evil.example',
    '/instrucoes%ZZ',
    '/login',
    '/LOGIN?redirect=/instrucoes',
    '/login/retorno',
    'javascript:alert(1)',
    'instrucoes',
    '',
  ])('rejects an unsafe destination: %s', (value) => {
    expect(safeAuthRedirect(value)).toBeUndefined()
    expect(authRedirectOrDefault(value)).toBe(DEFAULT_AUTH_REDIRECT)
  })
})
