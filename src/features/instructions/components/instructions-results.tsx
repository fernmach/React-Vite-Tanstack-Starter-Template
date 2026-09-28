import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApiError } from '@/lib/api-error'
import type { InstructionPage } from '../model/instruction'
import { DeleteInstructionDialog } from './delete-instruction-dialog'
import { InstructionActiveSwitch } from './instruction-active-switch'

export function InstructionsResults({
  loading,
  error,
  result,
  onRetry,
  onAnnounce = () => {},
}: {
  loading: boolean
  error: ApiError | null
  result: InstructionPage | null
  onRetry: () => void
  onAnnounce?: (message: string) => void
}) {
  if (loading)
    return (
      <div
        className="border-border bg-card rounded-sm border p-6"
        role="status"
      >
        Carregando instruções…
      </div>
    )
  if (error)
    return (
      <div
        className="border-destructive bg-card rounded-sm border p-6"
        role="alert"
      >
        <p className="font-medium">
          {error.kind === 'network'
            ? 'Você está offline.'
            : 'Não foi possível carregar as instruções.'}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {safeErrorDetail(error)}
        </p>
        <Button className="mt-4" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    )
  if (!result || result.total === 0)
    return (
      <div className="border-border bg-card rounded-sm border p-6">
        <p className="font-medium">Nenhuma instrução encontrada.</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Revise o termo pesquisado ou limpe o filtro.
        </p>
      </div>
    )
  return (
    <div className="border-border bg-card hidden rounded-sm border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código de MPV</TableHead>
            <TableHead>Descrição de MPV</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="text-center">Ativo</TableHead>
            <TableHead className="text-center">Editar</TableHead>
            <TableHead className="text-center">Excluir</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.items.map((item) => (
            <TableRow key={item.id} className="even:bg-muted/50">
              <TableCell className="font-medium">{item.code}</TableCell>
              <TableCell>{item.description}</TableCell>
              <TableCell className="max-w-md truncate">
                <a
                  className="text-primary underline-offset-4 hover:underline"
                  href={item.url}
                >
                  {item.url}
                </a>
              </TableCell>
              <TableCell className="text-center">
                <InstructionActiveSwitch
                  instruction={item}
                  onAnnounce={onAnnounce}
                />
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="ghost"
                  size="icon"
                  render={<a href={`/instrucoes/${item.id}/editar`} />}
                  aria-label={`Editar instrução ${item.code}`}
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </TableCell>
              <TableCell className="text-center">
                <DeleteInstructionDialog
                  instruction={item}
                  onAnnounce={onAnnounce}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function safeErrorDetail(error: ApiError) {
  switch (error.kind) {
    case 'network':
      return 'Sem conexão. Verifique sua internet e tente novamente.'
    case 'http':
      return error.message
    case 'validation':
      return 'Os dados recebidos não puderam ser exibidos com segurança. Tente novamente.'
    case 'unknown':
      return 'Ocorreu um erro inesperado. Tente novamente.'
  }
}
