import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, textStyles } from "../styles/tokens";

const _LoadingState: React.FC = () => (
  <View style={styles.row}>
    <ActivityIndicator size="small" color={colors.primary} />
    <Text style={styles.text}>{"Thinking..."}</Text>
  </View>
);

export const LoadingState = React.memo(_LoadingState);

const styles = StyleSheet.create({
  row: { padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  text: { ...textStyles.body, color: colors.textSecondary },
});
