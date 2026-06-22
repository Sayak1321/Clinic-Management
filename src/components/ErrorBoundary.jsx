import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'An unexpected error occurred.' };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a logging service
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-surface-100">
          <div className="card text-center max-w-sm p-6 bg-white rounded-card shadow-card">
            <h2 className="text-red-600 mb-2 font-semibold text-lg">Something went wrong</h2>
            <p className="text-sm text-slate-500 mb-4">{this.state.message}</p>
            <button
              className="btn-primary w-full"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
