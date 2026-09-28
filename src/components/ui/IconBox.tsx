import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { alpha, palette, useTheme } from '../../theme';

type Tone = 'green' | 'neutral' | 'accent' | 'danger';

/** Quadrado arredondado com ícone (size-10/11, rounded-xl, bg-green/15). */
export function IconBox({
  children,
  size = 44,
  tone = 'green',
  style,
}: {
  children: ReactNode;
  size?: number;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const { colors, radius } = useTheme();
  const backgroundColor = {
    green: alpha(palette.green, 0.15),
    neutral: alpha(palette.white, 0.05),
    accent: colors.accent,
    danger: alpha(palette.danger, 0.15),
  }[tone];

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: radius.md, backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
