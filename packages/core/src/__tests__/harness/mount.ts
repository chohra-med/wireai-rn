/**
 * The mount harness: the one place in this package that talks to a React
 * renderer. Tests import `mount` / `mountHook` and the query helpers below, and
 * never touch the renderer directly, so swapping it later is a one-file change.
 *
 * ─── RENDERER CHOICE (decided 2026-08-19, do not re-litigate) ───────────────
 *
 * PICKED: react-test-renderer plus the hand-written React Native host mocks in
 * `./react-native-mock`, wired per test file with `jest.mock("react-native")`.
 *
 * The alternative was @testing-library/react-native with its `react-native`
 * jest preset. It was rejected on blast radius, not on merit: that preset
 * rewrites how EVERY module in this package resolves and transforms, and the
 * suite it would rewrite is 151 already-green tests running under
 * `testEnvironment: "node"`. This harness was added to make three shipped
 * behaviours verifiable without changing any of them, so it takes the option
 * that needs zero jest configuration: the per-file `jest.mock` keeps the mock
 * scoped to the files that mount React, and `jest.config.js` is untouched.
 *
 * The kit repo (`@wireai/activation`, `test/canary/harness/mountCanary.ts`)
 * reached the same renderer by a different road. It runs `node:test`, which
 * ruled @testing-library out on its own; here the reason is the config delta.
 *
 * COST, ACCEPTED KNOWINGLY: react-test-renderer is deprecated in React 19 (this
 * monorepo pins react 19.2.0) and prints a one-time deprecation warning. Its
 * replacement, when React ships a supported headless renderer, is the three
 * calls in this file and nothing else.
 *
 * ─── The `.tsx` trap ────────────────────────────────────────────────────────
 *
 * jest's `testMatch` only collects files whose name ends in `.test.ts`, so a
 * `.test.tsx` file is collected by NOTHING and its absence looks exactly like a
 * green suite. Every harness test is therefore a plain `.ts` file that builds
 * elements with `React.createElement`, which is also why this helper exists
 * rather than JSX.
 *
 * This file lives under `src/__tests__/` and is excluded from the npm tarball
 * by the `files` field in package.json.
 */
import React from "react";
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { WireAIProvider } from "../../provider/WireAIProvider";
import type { LocalLLMConfig, Message, WireAIComponent } from "../../types";

export { flattenStyle } from "./react-native-mock";
export { act };

/**
 * React only batches inside `act` when it has been told it is in a test
 * environment. Without this, every state update warns and the warning is the
 * only sign that assertions may be reading a half-applied render.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type Mounted = {
  renderer: ReactTestRenderer;
  root: ReactTestInstance;
  unmount: () => void;
};

/** Mount an element on its own, with no Wire AI context around it. */
export const mount = (element: React.ReactElement): Mounted => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  if (!renderer) throw new Error("mount: TestRenderer.create did not return a renderer");
  const created = renderer;
  return {
    renderer: created,
    root: created.root,
    unmount: () => {
      act(() => {
        created.unmount();
      });
    },
  };
};

/**
 * The config the provider is handed when a test does not care about transport.
 * `baseUrl` points at a reserved-for-testing TLD so a stray request cannot
 * leave the machine; `stubFetch` below stops the provider's connectivity probe
 * from making one at all.
 */
const STUB_LLM: LocalLLMConfig = {
  provider: "webhook",
  baseUrl: "http://localhost.invalid/wire-harness",
  model: "stub-model",
};

export type ProviderOptions = {
  llm?: LocalLLMConfig;
  components?: WireAIComponent[];
  initialMessages?: Message[];
  streaming?: boolean;
  systemPromptSuffix?: string;
};

/**
 * Mount an element inside `<WireAIProvider>`. `useWireAIThread` throws outside
 * the provider (see `registry/registry-context.ts`), so anything that touches
 * the thread has to come through here.
 */
export const mountInProvider = (element: React.ReactElement, options: ProviderOptions = {}): Mounted =>
  mount(
    // `children` goes in the props object rather than as a third argument:
    // WireAIProvider declares it required, and createElement's overloads do not
    // credit a variadic child against a required `children` prop.
    React.createElement(WireAIProvider, {
      llm: options.llm ?? STUB_LLM,
      components: options.components ?? [],
      initialMessages: options.initialMessages,
      streaming: options.streaming,
      systemPromptSuffix: options.systemPromptSuffix,
      children: element,
    })
  );

/**
 * Mount a hook inside the provider and read its latest return value.
 *
 * `current()` re-reads on every call rather than capturing once, because the
 * whole point of the interruption tests is watching the value change after an
 * event the test fires.
 */
export const mountHook = <T>(
  useHook: () => T,
  options: ProviderOptions = {}
): { current: () => T; unmount: () => void } => {
  const captured: { value?: T; seen: boolean } = { seen: false };
  const Probe: React.FC = () => {
    captured.value = useHook();
    captured.seen = true;
    return null;
  };
  Probe.displayName = "HookProbe";

  const mounted = mountInProvider(React.createElement(Probe), options);
  return {
    current: () => {
      if (!captured.seen) throw new Error("mountHook: the probe never rendered");
      return captured.value as T;
    },
    unmount: mounted.unmount,
  };
};

/**
 * Let pending work and the state updates it causes settle: microtasks first,
 * then one turn of the macrotask queue, because an aborted request in this SDK
 * settles a timer tick after the abort rather than immediately.
 */
export const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
  });
};

/**
 * The host-element name a node renders as ("View", "Pressable", ...), or "" for
 * a composite component. Goes through `typeof` rather than comparing `type`
 * directly because `ReactTestInstance["type"]` is React's `ElementType`, which
 * does not overlap a React Native primitive name and makes a bare `===` a
 * compile error.
 */
export const hostTypeOf = (node: ReactTestInstance): string =>
  typeof node.type === "string" ? node.type : "";

/** Every rendered host node of the given mocked primitive, e.g. "Pressable". */
export const hostsOfType = (root: ReactTestInstance, hostType: string): ReactTestInstance[] =>
  root.findAll((node) => hostTypeOf(node) === hostType);

/** The concatenated text rendered anywhere beneath `node`. */
export const textUnder = (node: ReactTestInstance): string => {
  const parts: string[] = [];
  const visit = (current: ReactTestInstance | string): void => {
    if (typeof current === "string") {
      parts.push(current);
      return;
    }
    for (const child of current.children) visit(child);
  };
  visit(node);
  return parts.join("");
};

/**
 * The one `Pressable` whose rendered label is exactly `label`.
 *
 * Throws on zero matches and on more than one, because a query that silently
 * picks the first of several is how a test ends up asserting about a control
 * nobody meant to test.
 */
export const pressableByLabel = (root: ReactTestInstance, label: string): ReactTestInstance => {
  const matches = hostsOfType(root, "Pressable").filter((node) => textUnder(node) === label);
  if (matches.length === 0) {
    const seen = hostsOfType(root, "Pressable").map((node) => JSON.stringify(textUnder(node)));
    throw new Error(`pressableByLabel: no Pressable labelled ${JSON.stringify(label)}. Saw: [${seen.join(", ")}]`);
  }
  if (matches.length > 1) {
    throw new Error(`pressableByLabel: ${matches.length} Pressables labelled ${JSON.stringify(label)}`);
  }
  return matches[0] as ReactTestInstance;
};

/**
 * Fire the node's own `onPress`, exactly as the platform would on a tap.
 *
 * Deliberately does NOT check `disabled` first. The platform would, but a test
 * that stops here can only prove this helper works; firing through to the
 * component's handler is what proves the component's own guard is the thing
 * refusing the tap.
 */
export const press = (node: ReactTestInstance): void => {
  const onPress = node.props.onPress as unknown;
  if (typeof onPress !== "function") {
    throw new Error(`press: <${hostTypeOf(node) || "component"}> has no onPress prop`);
  }
  act(() => {
    (onPress as () => void)();
  });
};

/**
 * Replace `global.fetch` for the duration of a test. `WireAIProvider` fires a
 * connectivity probe in `__DEV__` (which jest sets true), and a test suite must
 * not depend on a network. Returns the restore function.
 */
export const stubFetch = (): (() => void) => {
  const original = global.fetch;
  const stub = jest.fn(async () => ({ ok: true, status: 200 }) as unknown as Response);
  global.fetch = stub as unknown as typeof fetch;
  return () => {
    global.fetch = original;
  };
};
