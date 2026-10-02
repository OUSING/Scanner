import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// Global error boundary — prevents a silent white page on crash
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0f172a', color: '#f87171', padding: '24px', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2 style={{ marginBottom: '12px' }}>⚠️ Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#fca5a5' }}>
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  document.body.innerHTML = '<p style="color:red;padding:24px">Root element not found</p>';
}
