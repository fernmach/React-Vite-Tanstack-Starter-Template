// Keep this module dependency-free. All application imports belong behind the
// guarded dynamic import in main.tsx, including environment, React and CSS.
export async function bootstrap(
  load: () => Promise<{ startApplication: () => Promise<void> }>,
) {
  try {
    const application = await load()
    await application.startApplication()
  } catch (error) {
    const container =
      document.getElementById('root') ??
      document.body.appendChild(document.createElement('main'))
    const alert = document.createElement('div')
    alert.setAttribute('role', 'alert')
    const title = document.createElement('h1')
    title.textContent = 'Não foi possível iniciar a aplicação.'
    const description = document.createElement('p')
    description.textContent =
      'Recarregue a página. Se o problema continuar, tente novamente mais tarde.'
    const reload = document.createElement('button')
    reload.type = 'button'
    reload.textContent = 'Recarregar aplicação'
    reload.addEventListener('click', () => window.location.reload())
    alert.append(title, description)
    container.replaceChildren(alert, reload)
    // Render before importing the reporter; its own import can also fail.
    try {
      const { errorReporting } = await import('@/lib/error-reporting')
      errorReporting.reportExecution(error, { source: 'startup' })
    } catch {
      /* The visible fallback is already available. */
    }
  }
}
