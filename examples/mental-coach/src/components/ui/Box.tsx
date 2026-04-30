import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { spacing } from 'wireai-rn';

interface BoxProps extends ViewProps {
  padding?: keyof typeof spacing;
  margin?: keyof typeof spacing;
  gap?: keyof typeof spacing;
  flex?: number;
  flexDirection?: ViewStyle['flexDirection'];
  alignItems?: ViewStyle['alignItems'];
  justifyContent?: ViewStyle['justifyContent'];
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  alignSelf?: ViewStyle['alignSelf'];
  maxWidth?: ViewStyle['maxWidth'];
  paddingHorizontal?: keyof typeof spacing;
  paddingVertical?: keyof typeof spacing;
  marginHorizontal?: keyof typeof spacing;
  marginVertical?: keyof typeof spacing;
}

export const Box: React.FC<BoxProps> = ({
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
  alignSelf,
  maxWidth,
  paddingHorizontal,
  paddingVertical,
  marginHorizontal,
  marginVertical,
  ...props
}) => {
  const boxStyle: ViewStyle = {
    padding: padding ? spacing[padding] : undefined,
    margin: margin ? spacing[margin] : undefined,
    paddingHorizontal: paddingHorizontal ? spacing[paddingHorizontal] : undefined,
    paddingVertical: paddingVertical ? spacing[paddingVertical] : undefined,
    marginHorizontal: marginHorizontal ? spacing[marginHorizontal] : undefined,
    marginVertical: marginVertical ? spacing[marginVertical] : undefined,
    gap: gap ? spacing[gap] : undefined,
    flex,
    flexDirection,
    alignItems,
    justifyContent,
    backgroundColor,
    borderRadius,
    borderWidth,
    borderColor,
    alignSelf,
    maxWidth,
  };

  return (
    <View style={[boxStyle, style]} {...props}>
      {children}
    </View>
  );
};
