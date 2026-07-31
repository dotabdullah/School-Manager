import { Component, ReactNode } from "react";
import { AlertOctagon } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Still shows up in DevTools console (F12 / right-click → Inspect) for full detail.
    console.error("Render crash caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-danger font-semibold">
              <AlertOctagon className="w-5 h-5" />
              This screen hit an error
            </div>
            <p className="text-sm text-ink-muted">
              Something crashed while rendering this page. Press <code>F12</code> (or right-click →
              Inspect) to open DevTools and check the Console tab for the full error — copy that text
              if you need help fixing it.
            </p>
            <pre className="text-xs bg-surface-raised rounded-lg p-3 overflow-x-auto text-danger whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-sm rounded-lg border border-border px-3 py-1.5 hover:bg-surface transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
