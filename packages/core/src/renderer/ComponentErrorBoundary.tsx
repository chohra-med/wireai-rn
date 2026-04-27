import React from "react";
import { devLog } from "../utils/dev-log";
import { FallbackMessage } from "./FallbackMessage";

type Props = {
  componentName: string;
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ComponentErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (__DEV__) {
      devLog.error(`ComponentErrorBoundary caught error in ${this.props.componentName}`, error);
    }
  }

  render() {
    if (this.state.hasError) {
      return <FallbackMessage componentName={this.props.componentName} />;
    }
    return this.props.children;
  }
}
