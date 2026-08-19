/**
 * Headless stand-ins for the React Native host primitives this SDK imports.
 *
 * WHY THIS EXISTS: jest runs with `testEnvironment: "node"` and no React Native
 * jest preset, and `node_modules/react-native` ships untranspiled Flow/ESM
 * source that ts-jest cannot load. Any test that mounts a built-in component
 * therefore has to resolve `react-native` to something a plain node process can
 * require. These mocks are that something.
 *
 * They are deliberately dumb: every primitive renders a host element named
 * after itself and passes its props straight through, so a test reads exactly
 * the props the component under test wrote. In particular `Pressable` does NOT
 * emulate the platform's own "a disabled Pressable swallows the press" rule.
 * That is on purpose: a test that fires `onPress` on a disabled node is then
 * measuring the COMPONENT's own guard rather than this file's, which is the
 * only way the guard can be seen to go red when it is removed.
 *
 * `StyleSheet.create` is the identity function, which is also what real React
 * Native does today, so a rendered `style` array holds the very objects the
 * component declared and a test can read a value off them.
 *
 * This file lives under `src/__tests__/` and is excluded from the npm tarball
 * by the `files` field in package.json. It must never be imported by runtime
 * source.
 */
import React from "react";

type HostProps = Record<string, unknown>;

const hostComponent = (name: string): React.FC<HostProps> => {
  const Host: React.FC<HostProps> = (props) => React.createElement(name, props);
  Host.displayName = name;
  return Host;
};

export const View = hostComponent("View");
export const Text = hostComponent("Text");
export const Pressable = hostComponent("Pressable");
export const TouchableOpacity = hostComponent("TouchableOpacity");
export const TextInput = hostComponent("TextInput");
export const ActivityIndicator = hostComponent("ActivityIndicator");

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown): Record<string, unknown> => flattenStyle(style),
};

/**
 * Collapse the `style` prop React Native accepts (an object, or an arbitrarily
 * nested array of objects and falsy entries) into one plain object, later
 * entries winning. Exported because assertions about a component's visual state
 * read a single resolved value, not an array shape.
 */
export const flattenStyle = (style: unknown): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const visit = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry);
      return;
    }
    if (typeof node === "object") Object.assign(out, node as Record<string, unknown>);
  };
  visit(style);
  return out;
};

type AppStateStatus = "active" | "background" | "inactive";
type AppStateListener = (state: AppStateStatus) => void;

const appStateListeners = new Set<AppStateListener>();

export const AppState = {
  currentState: "active" as AppStateStatus,
  addEventListener: (type: string, listener: AppStateListener) => {
    if (type === "change") appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) };
  },
};

/**
 * Drive an app-state transition the way the OS would. Named with the `__`
 * prefix the RN ecosystem uses for test-only escape hatches so it never reads
 * as part of the mocked surface.
 */
export const __emitAppState = (next: AppStateStatus): void => {
  AppState.currentState = next;
  for (const listener of [...appStateListeners]) listener(next);
};

/** Drop every registered app-state listener. Call between tests. */
export const __resetAppState = (): void => {
  appStateListeners.clear();
  AppState.currentState = "active";
};

/** How many `change` listeners are currently registered. */
export const __appStateListenerCount = (): number => appStateListeners.size;
