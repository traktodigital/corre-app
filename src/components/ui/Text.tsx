import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { TypographyVariant, useTheme } from '../../theme';

type Tone =
  | 'default'
  | 'muted'
  | 'highlight'
  | 'primary'
  | 'danger'
  | 'warning'
  | 'success';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: TextProps) {
  const { colors, typography, fonts } = useTheme();
  const { display, ...type } = typography[
    variant
  ] as (typeof typography)[TypographyVariant] & {
    display?: boolean;
  };

  const color = {
    default: colors.foreground,
    muted: colors.mutedForeground,
    highlight: colors.highlight,
    primary: colors.primary,
    danger: colors.destructive,
    warning: colors.warning,
    success: colors.success,
  }[tone];

  return (
    <RNText
      style={[
        { color, fontFamily: display ? fonts.display : fonts.body },
        type,
        style,
      ]}
      {...props}
    />
  );
}
