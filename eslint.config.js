import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const featureNames = ['instructions']

const productionSourceFiles = ['src/**/*.{ts,tsx}']
const productionSourceIgnores = ['src/**/*.test.{ts,tsx}', 'src/test/**']

const forbiddenFetchSelectors = [
  {
    selector: "CallExpression[callee.name='fetch']",
    message:
      'Application code must use a feature API operation backed by @/lib/api-client instead of fetch().',
  },
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.object.name=/^(globalThis|window)$/][callee.property.name='fetch']",
    message:
      'Application code must use a feature API operation backed by @/lib/api-client instead of fetch().',
  },
]

const forbiddenAxiosSelector = {
  selector: "ImportDeclaration[source.value='axios']",
  message:
    'Axios may only be imported by src/lib/api-client.ts. Use the shared apiClient from a feature API operation.',
}

const forbiddenEnvironmentSelector = {
  selector:
    "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][object.property.name='meta'][property.name='env']",
  message:
    'Read environment values through @/config/env; direct import.meta.env access is restricted to src/config/env.ts.',
}

const uiConsumerFiles = [
  'src/app/**/*.{ts,tsx}',
  'src/routes/**/*.{ts,tsx}',
  'src/features/*/components/**/*.{ts,tsx}',
  'src/features/*/pages/**/*.{ts,tsx}',
]

const featureBoundaryConfigs = featureNames.map((featureName) => ({
  name: `architecture/feature-${featureName}`,
  files: [`src/features/${featureName}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/app/*', '@/routes/*'],
            message:
              'Features cannot depend on the app or route composition layers.',
          },
          {
            regex: `^@/features/(?!${featureName}(?:/|$))`,
            message:
              'Features cannot import another feature internal implementation.',
          },
          {
            regex: '^\\.\\./\\.\\./',
            message:
              'Do not escape a feature with multi-level relative imports. Use the @/ alias and respect layer boundaries.',
          },
        ],
      },
    ],
  },
}))

export default tseslint.config(
  {
    ignores: ['dist', 'public/mockServiceWorker.js', 'src/routeTree.gen.ts'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['buttonVariants', 'useTheme'],
        },
      ],
    },
  },
  {
    name: 'architecture/api-transport',
    files: productionSourceFiles,
    ignores: [
      ...productionSourceIgnores,
      'src/lib/api-client.ts',
      'src/config/env.ts',
      ...uiConsumerFiles,
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        forbiddenAxiosSelector,
        ...forbiddenFetchSelectors,
        forbiddenEnvironmentSelector,
      ],
    },
  },
  {
    name: 'architecture/api-client-fetch',
    files: ['src/lib/api-client.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...forbiddenFetchSelectors,
        forbiddenEnvironmentSelector,
      ],
    },
  },
  {
    name: 'architecture/test-transport-imports',
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', forbiddenAxiosSelector],
    },
  },
  {
    name: 'architecture/environment-module',
    files: ['src/config/env.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        forbiddenAxiosSelector,
        ...forbiddenFetchSelectors,
      ],
    },
  },
  {
    name: 'architecture/api-ui-consumers',
    files: uiConsumerFiles,
    ignores: productionSourceIgnores,
    rules: {
      'no-restricted-syntax': [
        'error',
        forbiddenAxiosSelector,
        ...forbiddenFetchSelectors,
        {
          selector:
            "ImportDeclaration[source.value='@/lib/api-client'], ImportDeclaration[source.value=/api-client$/]",
          message:
            'Components, pages, routes, and app composition may import API hooks or types only; apiClient is restricted to feature API operations.',
        },
        forbiddenEnvironmentSelector,
      ],
    },
  },
  {
    name: 'architecture/shared-layer',
    files: [
      'src/components/**/*.{ts,tsx}',
      'src/lib/**/*.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/app/*', '@/routes/*'],
              message:
                'Shared modules cannot depend on features, app composition, or routes.',
            },
            {
              regex: '^\\.\\./',
              message:
                'Use the @/ alias for imports that leave the current shared directory.',
            },
          ],
        },
      ],
    },
  },
  ...featureBoundaryConfigs,
  prettier,
)
