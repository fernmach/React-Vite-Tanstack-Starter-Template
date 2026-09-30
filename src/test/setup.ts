import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetInstructionsStore } from '@/mocks/instructions-store'

Object.defineProperty(window, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
  writable: true,
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
})

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// Unmount React trees after every test to keep the DOM isolated.
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetInstructionsStore()
})

afterAll(() => {
  server.close()
})
