import { Component, ErrorInfo, ReactNode } from "react";

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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught error rendering the app:", error, errorInfo);
  }

  handleReload = () => {
    try {
      localStorage.removeItem("captcha_verified");
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#09090b",
            color: "#f4f4f5",
            padding: "24px",
            textAlign: "center",
            fontFamily: "monospace",
          }}
        >
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>Something went wrong</h1>
          <p style={{ opacity: 0.8, marginBottom: "16px", maxWidth: "480px" }}>
            The app hit an unexpected error while rendering. You can try reloading the page.
          </p>
          <pre
            style={{
              maxWidth: "100%",
              overflow: "auto",
              fontSize: "12px",
              opacity: 0.6,
              marginBottom: "16px",
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.handleReload}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid #3f3f46",
              backgroundColor: "#18181b",
              color: "#f4f4f5",
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
