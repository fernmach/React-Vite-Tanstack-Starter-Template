import path from 'path'
import { rm } from 'node:fs/promises'
import { defineConfig } from 'vitest/config'
import type { Plugin, ResolvedConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function excludeProductionMocks(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'exclude-production-mocks',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        const mockModule = Object.keys(output.modules).find((id) =>
          /[/\\](?:src[/\\]mocks|node_modules[/\\]msw)[/\\]/.test(id),
        )
        if (mockModule) this.error(`Production chunk contains ${mockModule}`)
      }
    },
    async closeBundle() {
      // Vite copies public/ verbatim; the browser worker belongs to development.
      await rm(
        path.resolve(config.root, config.build.outDir, 'mockServiceWorker.js'),
        {
          force: true,
        },
      )
    },
  }
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_DEVELOPMENT__: JSON.stringify(mode !== 'production'),
  },
  plugins: [
    excludeProductionMocks(),
    tailwindcss(),
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    maxWorkers: 4,
    globals: false,
    css: true,
  },
}))
