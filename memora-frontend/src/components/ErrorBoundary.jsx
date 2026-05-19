import React from 'react';
import { AlertCircle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.MODE === 'development';

      return (
        <div className="min-h-screen flex items-center justify-center bg-black px-4">
          <div className="w-full max-w-md border border-white/10 rounded-lg bg-white/[0.02] p-6 backdrop-blur">
            <div className="flex gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h1 className="text-lg font-semibold text-white">Something went wrong</h1>
            </div>

            <p className="text-sm text-gray-300 mb-4">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {isDev && this.state.error && (
              <div className="mt-4 p-3 bg-red-950/20 border border-red-500/30 rounded text-xs text-red-200 font-mono max-h-48 overflow-auto">
                <p className="font-semibold mb-2">Error Details (Development Only):</p>
                <p className="mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <p className="text-xs text-red-300 mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Go Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 border border-white/20 hover:bg-white/5 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
