import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /loading chunk|dynamically imported module|failed to fetch/i.test(error?.message || '');
    return { hasError: true, isChunkError, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chunk loading error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center border border-gray-200 dark:border-gray-800 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {this.state.isChunkError ? 'Application Update Available' : 'Something went wrong'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {this.state.isChunkError
                ? 'A new version of the application was deployed. Please reload the page to get the latest updates.'
                : 'An error occurred while loading this section. Please reload to try again.'}
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
