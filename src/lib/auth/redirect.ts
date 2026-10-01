export const DEFAULT_AUTH_REDIRECT = '/instrucoes'

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
}

export function safeAuthRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  if (
    hasControlCharacters(value) ||
    value.includes('\\') ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return undefined
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return undefined
  }

  if (
    hasControlCharacters(decoded) ||
    decoded.includes('\\') ||
    decoded.startsWith('//')
  ) {
    return undefined
  }

  let destination: URL
  try {
    destination = new URL(value, 'https://task-desk.invalid')
  } catch {
    return undefined
  }

  if (destination.origin !== 'https://task-desk.invalid') return undefined

  let decodedPathname: string
  try {
    decodedPathname = decodeURIComponent(destination.pathname)
  } catch {
    return undefined
  }

  const normalizedPathname = decodedPathname.toLocaleLowerCase('en-US')
  if (
    normalizedPathname === '/login' ||
    normalizedPathname.startsWith('/login/') ||
    decodedPathname.startsWith('//') ||
    decodedPathname.includes('\\') ||
    hasControlCharacters(decodedPathname)
  ) {
    return undefined
  }

  return `${destination.pathname}${destination.search}${destination.hash}`
}

export function authRedirectOrDefault(value: unknown): string {
  return safeAuthRedirect(value) ?? DEFAULT_AUTH_REDIRECT
}
