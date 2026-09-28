import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
};

const heights: Record<Size, number> = { sm: 36, md: 44, lg: 52 };

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  fullWidth,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors, radius } = useTheme();

  const tone = {
    primary: {
      bg: colors.primary,
      fg: colors.primaryForeground,
      border: colors.primary,
    },
    secondary: {
      bg: colors.secondary,
      fg: colors.secondaryForeground,
      border: colors.secondary,
    },
    outline: { bg: colors.card, fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.foreground, border: 'transparent' },
    destructive: {
      bg: colors.destructive,
      fg: colors.destructiveForeground,
      border: colors.destructive,
    },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={state => [
        styles.base,
        {
          height: heights[size],
          paddingHorizontal: size === 'sm' ? 12 : 16,
          borderRadius: radius.md,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
        },
        fullWidth && styles.full,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text
            variant={size === 'sm' ? 'caption' : 'small'}
            style={[styles.label, { color: tone.fg }]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  full: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '700' },
});
