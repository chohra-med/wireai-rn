import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { devLog } from "../utils/dev-log";
import { useWireAIContext } from "../registry/registry-context";
import type { ComponentRegistry } from "../registry/component-registry";
import { isNodeRefArray } from "../schema/node-ref.schema";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import type {
  CallbackOverrides,
  InjectedProps,
  WireAINodeRef,
  WireAIResponse,
} from "../types";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary";
import { FallbackMessage } from "./FallbackMessage";

/** Mirror of `MAX_NODE_DEPTH` in validate-response.ts — kept local to avoid a circular import. */
const MAX_RENDER_DEPTH = 8;

type ComponentRendererProps = {
  messageId: string;
  response: WireAIResponse;
  callbackOverrides?: CallbackOverrides;
  /**
   * When true, does two things: it soft-fails nested validation errors, so a
   * node whose props have not fully arrived renders `null` and waits for more
   * chunks instead of showing a fallback, and it is injected into every
   * rendered component, where the interactive built-ins use it to disable
   * their controls until the message is complete.
   */
  isStreaming?: boolean;
};

type RenderCtx = {
  registry: ComponentRegistry;
  messageId: string;
  callbackOverrides: CallbackOverrides;
  isStreaming: boolean;
};

const renderNode = (
  node: WireAINodeRef,
  ctx: RenderCtx,
  depth: number,
  keyHint: string
): React.ReactNode => {
  if (depth > MAX_RENDER_DEPTH) {
    if (ctx.isStreaming) return null;
    return (
      <FallbackMessage
        key={keyHint}
        componentName={`${node.component} (depth>${MAX_RENDER_DEPTH})`}
      />
    );
  }

  const def = ctx.registry.get(node.component);
  if (!def) {
    if (ctx.isStreaming) return null;
    return (
      <View key={keyHint} style={styles.unknownBubble}>
        <Text style={styles.unknownText}>{`Unknown component: ${node.component}`}</Text>
      </View>
    );
  }

  const rawProps = (node.props ?? {}) as Record<string, unknown>;
  const parsed = def.propsSchema.safeParse(rawProps);
  if (!parsed.success) {
    if (ctx.isStreaming) return null;
    if (__DEV__) {
      devLog.warn(`ComponentRenderer: props validation failed for ${node.component}`, {
        issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    return <FallbackMessage key={keyHint} componentName={node.component} />;
  }

  // Pre-render any NodeRef arrays found in the raw props so containers receive
  // ready-to-mount ReactNode[] instead of having to recurse themselves.
  const dataProps: Record<string, unknown> = {
    ...def.defaultProps,
    ...(parsed.data as Record<string, unknown>),
  };
  for (const [key, value] of Object.entries(rawProps)) {
    if (isNodeRefArray(value)) {
      dataProps[key] = value.map((child, i) =>
        renderNode(child, ctx, depth + 1, `${keyHint}.${key}[${i}]`)
      );
    }
  }

  const injected: InjectedProps = {
    messageId: ctx.messageId,
    renderNode: (child: WireAINodeRef) =>
      renderNode(child, ctx, depth + 1, `${keyHint}.dyn`),
    isStreaming: ctx.isStreaming,
  };
  const merged = { ...dataProps, ...ctx.callbackOverrides, ...injected };
  const Component = def.component as React.ComponentType<Record<string, unknown>>;

  return (
    <ComponentErrorBoundary key={keyHint} componentName={node.component}>
      <Component {...merged} />
    </ComponentErrorBoundary>
  );
};

const _ComponentRenderer: React.FC<ComponentRendererProps> = ({
  messageId,
  response,
  callbackOverrides = {},
  isStreaming = false,
}) => {
  const { registry } = useWireAIContext();

  if (response.action === "ask") {
    return (
      <View style={styles.askBubble}>
        <Text style={styles.askText}>{response.message}</Text>
      </View>
    );
  }

  const ctx: RenderCtx = { registry, messageId, callbackOverrides, isStreaming };
  return <>{renderNode(response, ctx, 0, "root")}</>;
};

export const ComponentRenderer = React.memo(_ComponentRenderer);

const styles = StyleSheet.create({
  askBubble: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    marginVertical: spacing.xs,
  },
  askText: { ...textStyles.body, color: colors.text },
  unknownBubble: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
  },
  unknownText: { ...textStyles.caption, color: colors.textSecondary },
});
