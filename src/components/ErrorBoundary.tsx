import React from 'react';
import { toast } from 'sonner';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { hasError: true, message };
  }

  public componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error);
    toast.error(`Something went wrong: ${message}`);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full p-6">
          <div className="bg-card border rounded-lg p-5 space-y-3">
            <h2 className="text-lg font-semibold text-destructive">Page failed to render</h2>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error. Try refreshing the page or navigating back.
            </p>
            {this.state.message && (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted p-3 rounded-md">
                {this.state.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

