import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { textStyles, colors } from 'wireai-rn';

interface TypographyProps extends TextProps {
  variant?: keyof typeof textStyles;
  color?: string;
  textAlign?: TextStyle['textAlign'];
}

export const Typography: React.FC<TypographyProps> = ({
  children,
  style,
  variant = 'body',
  color = colors.text,
  textAlign,
  ...props
}) => {
  return (
    <Text
      style={[
        textStyles[variant],
        { color, textAlign },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
