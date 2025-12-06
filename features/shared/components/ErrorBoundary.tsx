import React, { Component, ErrorInfo, ReactNode } from "react";
import { reportError } from "@/services/telemetry/errorReporter";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  /**
   * React lifecycle hook that updates state when a descendant throws.
   * This renders the fallback UI on the next paint while preserving the error for diagnostics.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Reports errors to the telemetry pipeline with component stack details.
   * Side-effect only; rendering is handled by `getDerivedStateFromError`.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(error, { errorInfo });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-center p-8">
          <div>

            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              We encountered an unexpected error. Your data is likely safe in the browser's storage. 
              Try reloading the page.
            </p>
            <button 
              onClick={this.handleReload}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Reload Application
            </button>
            {this.state.error && (
              <div className="mt-8 p-4 bg-gray-100 rounded text-left overflow-auto max-w-lg mx-auto text-xs font-mono">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
