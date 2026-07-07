import { Component } from "react";
import { ErrorDisplay } from "./ErrorDisplay";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorDisplay
          message={this.state.error.message || "Terjadi kesalahan yang tidak terduga."}
          onRetry={() => {
            // Reload penuh — paling andal memulihkan chunk yang gagal dimuat
            // (penyebab umum layar blank saat pertama buka di jaringan HP).
            if (typeof window !== "undefined") {
              window.location.reload();
            } else {
              this.setState({ error: null });
            }
          }}
        />
      );
    }
    return this.props.children;
  }
}
