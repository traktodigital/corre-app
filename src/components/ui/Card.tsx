import { StyleSheet, View, ViewProps } from 'react-native';
import { glow, useTheme } from '../../theme';

export type CardProps = ViewProps & {
  padding?: number;
  glowing?: boolean;
  dashed?: boolean;
};

/** rounded-2xl border border-border bg-card p-4/p-5 */
export function Card({
  padding = 16,
  glowing,
  dashed,
  style,
  ...props
}: CardProps) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          padding,
          borderRadius: radius['2xl'],
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        dashed && styles.dashed,
        glowing && glow(colors.highlight, 0.25),
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
  dashed: { borderStyle: 'dashed' },
});
