/**
 * ErrorBoundary Component
 * 
 * Catches React errors and Supabase connection failures.
 * Shows graceful error UI instead of crashing the app.
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] ❌ Error caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
      retryCount: 0,
    });
  }

  handleRetry = () => {
    console.log('[ErrorBoundary] 🔄 Retrying...');
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, retryCount } = this.state;
      const isSupabaseError = error?.message?.includes('Supabase') ||
                               error?.message?.includes('CORS') ||
                               error?.message?.includes('fetch');

      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-red-100 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
            {/* Error Icon */}
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 p-4 rounded-full">
                <AlertTriangle size={48} className="text-red-600" />
              </div>
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-4">
              {isSupabaseError ? '🔌 Connection Error' : '⚠️ Something Went Wrong'}
            </h1>

            {/* Error Message */}
            <p className="text-gray-600 text-center mb-6">
              {isSupabaseError
                ? 'Unable to connect to the database. Please check your internet connection or try again later.'
                : 'An unexpected error occurred. The app is now in offline-only mode. Some features may be limited.'}
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="mb-6 text-xs bg-gray-100 p-4 rounded border border-gray-300">
                <summary className="cursor-pointer font-semibold text-gray-700 mb-2">
                  Error Details
                </summary>
                <div className="text-gray-600 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {error.toString()}
                </div>
                {errorInfo && (
                  <div className="mt-3 text-gray-600 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
                    {errorInfo.componentStack}
                  </div>
                )}
              </details>
            )}

            {/* Retry Info */}
            <p className="text-xs text-gray-500 text-center mb-6">
              Retry attempt: {retryCount}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                <RefreshCw size={18} />
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full bg-gray-300 text-gray-900 px-4 py-3 rounded-lg font-semibold hover:bg-gray-400 transition-all"
              >
                Reload Page
              </button>
            </div>

            {/* Support Note */}
            <p className="text-xs text-gray-500 text-center mt-6">
              If the problem persists, please contact support or check your network connection.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
