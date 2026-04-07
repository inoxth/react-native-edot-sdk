import React from 'react';
import { reportError } from '../instrumentation/errors';

interface EdotErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface EdotErrorBoundaryState {
  hasError: boolean;
}

export class EdotErrorBoundary extends React.Component<
  EdotErrorBoundaryProps,
  EdotErrorBoundaryState
> {
  state: EdotErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): EdotErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    try {
      reportError(error, 'js_render_error', false);
    } catch {
      // SDK error — never crash the host app
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
