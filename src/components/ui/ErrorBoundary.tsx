import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconWarning } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="h-full min-h-[280px] flex items-center justify-center p-6">
          <div className="card w-full max-w-md p-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center">
              <IconWarning className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">發生錯誤</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                此區域發生未預期錯誤，請重試或重新整理頁面。
              </p>
            </div>
            <button type="button" onClick={this.handleRetry} className="btn-primary w-full">
              重試
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
