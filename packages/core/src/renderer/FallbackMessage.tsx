import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, textStyles } from "../styles/tokens";

type FallbackMessageProps = {
  componentName: string;
};

const _FallbackMessage: React.FC<FallbackMessageProps> = ({ componentName }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{`Component "${componentName}" could not render.`}</Text>
  </View>
);

export const FallbackMessage = React.memo(_FallbackMessage);

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { ...textStyles.caption, color: colors.textSecondary },
});
