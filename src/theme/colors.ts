/**
 * Paleta oficial CORRE — extraída de goias-delivery-link/src/styles.css.
 * Mantenha os dois lados em sincronia ao mudar uma cor.
 */
export const palette = {
  green: '#109150',
  greenDark: '#0b6b3c',
  greenLight: '#1db268',
  neon: '#3ddc84',
  black: '#0c0c0c',
  black2: '#141414',
  borderDark: '#232323',
  white: '#ffffff',
  grayBg: '#f5f6f8',
  textDark: '#fafafa',
  textMuted: '#9ca3af',
  danger: '#ef4444',
  warning: '#f59e0b',
  mint: '#7fe6b0',
} as const;

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  warning: string;
  success: string;
  highlight: string;
  border: string;
  input: string;
  ring: string;
  tabBar: string;
  chart: [string, string, string, string, string];
};

/** Tema escuro — app do entregador (padrão do app mobile). */
export const darkColors: ThemeColors = {
  background: palette.black,
  foreground: palette.textDark,
  card: palette.black2,
  cardForeground: palette.textDark,
  primary: palette.green,
  primaryForeground: palette.white,
  secondary: '#1b1b1b',
  secondaryForeground: palette.textDark,
  muted: '#1b1b1b',
  mutedForeground: palette.textMuted,
  accent: '#17301f',
  accentForeground: palette.neon,
  destructive: palette.danger,
  destructiveForeground: palette.white,
  warning: palette.warning,
  success: palette.greenLight,
  highlight: palette.neon,
  border: palette.borderDark,
  input: palette.borderDark,
  ring: palette.greenLight,
  tabBar: palette.black2,
  chart: [
    palette.neon,
    palette.greenLight,
    palette.green,
    palette.greenDark,
    palette.mint,
  ],
};

/** Tema claro — equivalente aos painéis web. */
export const lightColors: ThemeColors = {
  background: palette.grayBg,
  foreground: '#101418',
  card: palette.white,
  cardForeground: '#101418',
  primary: palette.green,
  primaryForeground: palette.white,
  secondary: '#e9ecf1',
  secondaryForeground: '#101418',
  muted: '#eef0f4',
  mutedForeground: '#6b7280',
  accent: '#e3f5ea',
  accentForeground: palette.greenDark,
  destructive: palette.danger,
  destructiveForeground: palette.white,
  warning: palette.warning,
  success: palette.green,
  highlight: palette.green,
  border: '#e2e5ea',
  input: '#e2e5ea',
  ring: palette.green,
  tabBar: palette.white,
  chart: [
    palette.green,
    palette.greenLight,
    palette.neon,
    palette.greenDark,
    palette.mint,
  ],
};

/**
 * Equivalente ao `cor/15` do Tailwind: aplica opacidade a uma cor hex.
 * alpha('#3ddc84', 0.15) -> 'rgba(61, 220, 132, 0.15)'
 */
export function alpha(hex: string, opacity: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map(c => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
