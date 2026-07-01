import React from "react";

interface RuntimeErrorBoundaryState {
  error: Error | null;
}

export class RuntimeErrorBoundary extends React.Component<
  React.PropsWithChildren,
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[asset-composer][runtime-boundary]", {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
      (
        window as typeof window & {
          __assetComposerLastRuntimeError?: {
            message: string;
            stack?: string;
            componentStack: string;
          };
        }
      ).__assetComposerLastRuntimeError = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      };
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="max-w-xl rounded-lg border border-border bg-card p-6">
            <h1 className="text-lg font-semibold">Runtime error</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the browser console for the full component stack.
            </p>
            <pre className="mt-4 overflow-auto rounded bg-background p-3 text-xs text-red-300">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
