"use client";

import { Component, type ReactNode } from "react";

export class QueryErrorBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <p role="alert" className="text-xs text-red-700">{this.props.message} Reload to check again.</p>;
    return this.props.children;
  }
}
