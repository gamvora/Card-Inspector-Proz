import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "24px",
            textAlign: "center",
            backgroundColor: "#09090b",
            color: "#fafafa",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, fontSize: "0.875rem" }}>
            {this.state.error?.message || "The app failed to load. Please try reopening it."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #3f3f46",
              background: "transparent",
              color: "#fafafa",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
