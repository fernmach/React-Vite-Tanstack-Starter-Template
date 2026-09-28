export const allowedFixture = {
  'src/app/provider.tsx': `
import { QueryClientProvider } from '@tanstack/react-query'
export function Provider() { return <QueryClientProvider client={{} as never} /> }
`,
  'src/features/catalog/api/get-products.ts': `
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
export const productsResponseSchema = {}
export async function getProducts() { return apiClient.get('/products', { responseSchema: {} as never }) }
export function useProducts() { return useQuery({ queryKey: ['products'], queryFn: getProducts }) }
`,
  'src/features/catalog/components/products.tsx': `
import { useProducts, type ProductsResponse } from '../api/get-products'
export function Products() { useProducts(); return null as ProductsResponse | null }
`,
}

export const forbiddenFixture = {
  'src/features/catalog/api/get-products.ts': `
import { useQuery } from '@tanstack/react-query'
export async function getProducts() { return fetch('/products') }
export const API_GENERATOR_TODO = true
export function products() { return useQuery({ queryKey: ['products'], queryFn: getProducts }) }
`,
  'src/features/catalog/pages/products-page.tsx': `
import { getProducts } from '../api/get-products'
export function ProductsPage() { void getProducts(); return null }
`,
}
