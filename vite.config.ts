import path from 'path'
import { rm } from 'node:fs/promises'
import { defineConfig } from 'vitest/config'
import type { Plugin, ResolvedConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function excludeProductionOnlyModules(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'exclude-production-only-modules',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        const developmentModule = Object.keys(output.modules).find((id) =>
          /[/\\](?:src[/\\]mocks|node_modules[/\\](?:msw|@tanstack[/\\](?:router|react-query)-devtools))[/\\]/.test(
            id,
          ),
        )
        if (developmentModule)
          this.error(`Production chunk contains ${developmentModule}`)
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
    __APP_QUERY_DEVTOOLS__: JSON.stringify(mode === 'development'),
    __APP_ROUTER_DEVTOOLS__: JSON.stringify(mode === 'development'),
  },
  plugins: [
    excludeProductionOnlyModules(),
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
