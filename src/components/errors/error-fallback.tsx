type ErrorFallbackProps = {
  scope: 'application' | 'route' | 'section'
  onReset: () => void
}

export function ErrorFallback({ scope, onReset }: ErrorFallbackProps) {
  const title =
    scope === 'section'
      ? 'Não foi possível exibir esta seção.'
      : scope === 'route'
        ? 'Não foi possível exibir esta página.'
        : 'Não foi possível exibir a aplicação.'

  return (
    <div className="bg-background text-foreground space-y-4 rounded-md border p-6">
      <div role="alert">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p>
          Ocorreu um problema inesperado. Você pode tentar abrir esta área
          novamente.
        </p>
      </div>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          className="rounded border px-4 py-2 focus-visible:outline-2"
          onClick={onReset}
        >
          Tentar novamente
        </button>
        {scope !== 'section' ? (
          <>
            <button
              type="button"
              className="rounded border px-4 py-2 focus-visible:outline-2"
              onClick={() => window.location.reload()}
            >
              Recarregar aplicação
            </button>
            <a className="self-center underline" href="/">
              Ir para o início
            </a>
          </>
        ) : null}
      </div>
    </div>
  )
}
