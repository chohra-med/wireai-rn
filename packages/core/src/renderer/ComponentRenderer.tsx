import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { devLog } from "../utils/dev-log";
import { useWireAIContext } from "../registry/registry-context";
import { colors, radii, spacing, textStyles } from "../styles/tokens";
import type { WireAIResponse, CallbackOverrides, InjectedProps } from "../types";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary";
import { FallbackMessage } from "./FallbackMessage";

type ComponentRendererProps = {
  messageId: string;
  response: WireAIResponse;
  callbackOverrides?: CallbackOverrides;
};

const _ComponentRenderer: React.FC<ComponentRendererProps> = ({
  messageId,
  response,
  callbackOverrides = {},
}) => {
  const { registry } = useWireAIContext();

  // Validate once per (component, props) pair — useMemo prevents re-running on unrelated re-renders
  const validationResult = useMemo(() => {
    if (response.action !== "render") return null;
    const def = registry.get(response.component);
    if (!def) return null;
    return def.propsSchema.safeParse(response.props);
  }, [registry, response]);

  if (response.action === "ask") {
    return (
      <View style={styles.askBubble}>
        <Text style={styles.askText}>{response.message}</Text>
      </View>
    );
  }

  const def = registry.get(response.component);
  if (!def) {
    return (
      <View style={styles.unknownBubble}>
        <Text style={styles.unknownText}>{`Unknown component: ${response.component}`}</Text>
      </View>
    );
  }

  if (!validationResult?.success) {
    if (__DEV__ && validationResult) {
      devLog.warn(`ComponentRenderer: props validation failed for ${response.component}`, {
        issues: validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      });
    }
    return <FallbackMessage componentName={response.component} />;
  }

  const resolvedProps = { ...def.defaultProps, ...validationResult.data };
  const injected: InjectedProps = { messageId };
  const mergedProps = { ...resolvedProps, ...callbackOverrides, ...injected };
  const Component = def.component as React.ComponentType<Record<string, unknown>>;

  return (
    <ComponentErrorBoundary componentName={response.component}>
      <Component {...mergedProps} />
    </ComponentErrorBoundary>
  );
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
