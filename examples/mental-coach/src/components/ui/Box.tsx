import React from "react";
import type { ViewProps, ViewStyle } from "react-native";
import { View } from "react-native";
import { spacing } from "wireai-rn";

type BoxProps = ViewProps & {
  padding?: keyof typeof spacing;
  paddingHorizontal?: keyof typeof spacing;
  paddingVertical?: keyof typeof spacing;
  margin?: keyof typeof spacing;
  marginHorizontal?: keyof typeof spacing;
  marginVertical?: keyof typeof spacing;
  gap?: keyof typeof spacing;
  flex?: number;
  flexDirection?: ViewStyle["flexDirection"];
  alignItems?: ViewStyle["alignItems"];
  alignSelf?: ViewStyle["alignSelf"];
  justifyContent?: ViewStyle["justifyContent"];
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderTopWidth?: number;
  borderBottomWidth?: number;
  borderColor?: string;
  maxWidth?: ViewStyle["maxWidth"];
};

const _Box: React.FC<BoxProps> = ({
  children,
  style,
  padding,
  paddingHorizontal,
  paddingVertical,
  margin,
  marginHorizontal,
  marginVertical,
  gap,
  flex,
  flexDirection,
  alignItems,
  alignSelf,
  justifyContent,
  backgroundColor,
  borderRadius,
  borderWidth,
  borderTopWidth,
  borderBottomWidth,
  borderColor,
  maxWidth,
  ...props
}) => {
  const boxStyle: ViewStyle = {
    padding: padding ? spacing[padding] : undefined,
    paddingHorizontal: paddingHorizontal ? spacing[paddingHorizontal] : undefined,
    paddingVertical: paddingVertical ? spacing[paddingVertical] : undefined,
    margin: margin ? spacing[margin] : undefined,
    marginHorizontal: marginHorizontal ? spacing[marginHorizontal] : undefined,
    marginVertical: marginVertical ? spacing[marginVertical] : undefined,
    gap: gap ? spacing[gap] : undefined,
    flex,
    flexDirection,
    alignItems,
    alignSelf,
    justifyContent,
    backgroundColor,
    borderRadius,
    borderWidth,
    borderTopWidth,
    borderBottomWidth,
    borderColor,
    maxWidth,
  };

  return (
    <View style={[boxStyle, style]} {...props}>
      {children}
    </View>
  );
};

export const Box = React.memo(_Box);
