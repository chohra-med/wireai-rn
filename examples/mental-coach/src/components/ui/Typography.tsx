import React, { useMemo } from "react";
import type { TextProps, TextStyle } from "react-native";
import { Text } from "react-native";
import { colors, textStyles } from "wireai-rn";

type TypographyProps = TextProps & {
  variant?: keyof typeof textStyles;
  color?: string;
  textAlign?: TextStyle["textAlign"];
};

const _Typography: React.FC<TypographyProps> = ({
  children,
  style,
  variant = "body",
  color = colors.text,
  textAlign,
  ...props
}) => {
  const dynamicStyle = useMemo<TextStyle>(
    () => ({ color, textAlign }),
    [color, textAlign]
  );

  return (
    <Text style={[textStyles[variant], dynamicStyle, style]} {...props}>
      {children}
    </Text>
  );
};

export const Typography = React.memo(_Typography);
