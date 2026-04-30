import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { spacing } from '../../styles/tokens';

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
