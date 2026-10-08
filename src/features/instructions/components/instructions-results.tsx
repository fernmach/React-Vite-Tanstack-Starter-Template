import { Pencil } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
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
import { instructionQueryErrorCopy } from '../model/instruction-error-copy'
import { DeleteInstructionDialog } from './delete-instruction-dialog'
import { InstructionActiveSwitch } from './instruction-active-switch'
import { useInstructionPermissions } from './use-instruction-permissions'

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
  const { canUpdate, canArchive } = useInstructionPermissions()

  if (loading)
    return (
      <div className="border-border bg-card flex flex-col gap-4 rounded-sm border p-6">
        <p className="sr-only" role="status">
          Carregando instruções…
        </p>
        <Skeleton className="h-5 w-48" aria-hidden="true" />
        <Skeleton className="h-4 w-full" aria-hidden="true" />
        <Skeleton className="h-4 w-4/5" aria-hidden="true" />
      </div>
    )
  if (error)
    return (
      <Alert
        variant={error.status === 401 ? 'default' : 'destructive'}
        role={error.status === 401 ? 'status' : 'alert'}
      >
        <AlertTitle>{instructionQueryErrorCopy(error)}</AlertTitle>
        <AlertDescription>
          <Button className="mt-4" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    )
  if (!result || result.total === 0)
    return (
      <Empty className="border-border bg-card border">
        <EmptyHeader>
          <EmptyTitle>Nenhuma instrução encontrada.</EmptyTitle>
          <EmptyDescription>
            Revise o termo pesquisado ou limpe o filtro.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
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
            {canUpdate && <TableHead className="text-center">Editar</TableHead>}
            {canArchive && (
              <TableHead className="text-center">Excluir</TableHead>
            )}
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
              {canUpdate && (
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    render={<a href={`/instrucoes/${item.id}/editar`} />}
                    aria-label={`Editar instrução ${item.code}`}
                  >
                    <Pencil data-icon="inline-start" aria-hidden="true" />
                  </Button>
                </TableCell>
              )}
              {canArchive && (
                <TableCell className="text-center">
                  <DeleteInstructionDialog
                    instruction={item}
                    onAnnounce={onAnnounce}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
