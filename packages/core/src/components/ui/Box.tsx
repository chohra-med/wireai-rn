import React from "react";
import type { ViewProps, ViewStyle } from "react-native";
import { View } from "react-native";
import { spacing } from "../../styles/tokens";

type BoxProps = ViewProps & {
  padding?: keyof typeof spacing;
  margin?: keyof typeof spacing;
  gap?: keyof typeof spacing;
  flex?: number;
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  justifyContent?: ViewStyle["justifyContent"];
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
};

const _Box: React.FC<BoxProps> = ({
  children,
  style,
  padding,
  margin,
  gap,
  flex,
  flexDirection,
  alignItems,
  justifyContent,
  backgroundColor,
  borderRadius,
  borderWidth,
  borderColor,
  ...props
}) => {
  const boxStyle: ViewStyle = {
    padding: padding ? spacing[padding] : undefined,
    margin: margin ? spacing[margin] : undefined,
    gap: gap ? spacing[gap] : undefined,
    flex,
    flexDirection,
    alignItems,
    justifyContent,
    backgroundColor,
    borderRadius,
    borderWidth,
    borderColor,
  };

  return (
    <View style={[boxStyle, style]} {...props}>
      {children}
    </View>
  );
};

export const Box = React.memo(_Box);
