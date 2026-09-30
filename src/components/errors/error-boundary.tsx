import { Component, type PropsWithChildren } from 'react'
import { errorReporting } from '@/lib/error-reporting'
import { ErrorFallback } from './error-fallback'

type Scope = 'application' | 'section'
type BoundaryProps = PropsWithChildren<{ scope: Scope }>

// Only explicit user resets are supported. The fallback needs no providers.
class RenderBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }
  private error: unknown

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.error = error
    errorReporting.report(error, { source: this.props.scope })
  }

  render() {
    return this.state.failed ? (
      <ErrorFallback
        scope={this.props.scope}
        onReset={() => {
          errorReporting.beginAttempt(this.error)
          this.setState({ failed: false })
        }}
      />
    ) : (
      this.props.children
    )
  }
}

export function ApplicationErrorBoundary({ children }: PropsWithChildren) {
  return <RenderBoundary scope="application">{children}</RenderBoundary>
}

export function SectionErrorBoundary({ children }: PropsWithChildren) {
  return <RenderBoundary scope="section">{children}</RenderBoundary>
}
