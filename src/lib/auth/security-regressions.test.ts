import { describe, expect, it } from 'vitest'

const sourceModules = import.meta.glob('/src/**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

const productionSources = Object.entries(sourceModules).filter(
  ([file]) => !file.includes('.test.'),
)

describe('authentication security regressions', () => {
  it('keeps auth source independent from browser persistence and token decoding', () => {
    const authSource = productionSources
      .filter(([file]) => file.startsWith('/src/lib/auth/'))
      .map(([, source]) => source)
      .join('\n')

    expect(authSource).not.toMatch(
      /localStorage|sessionStorage|indexedDB|document\.cookie|jwtDecode|atob\s*\(/,
    )
    expect(authSource).not.toMatch(/accessToken|refreshToken/)
  })

  it('has no untrusted HTML rendering sink in production source', () => {
    const violations = productionSources
      .filter(([, source]) =>
        /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/.test(
          source,
        ),
      )
      .map(([file]) => file)

    expect(violations).toEqual([])
  })
})
