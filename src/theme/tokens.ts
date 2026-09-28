import { Platform, TextStyle, ViewStyle } from 'react-native';
import { palette } from './colors';

/** Escala de 4px, igual ao Tailwind (1 = 4px). */
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/** --radius do web = 0.875rem (14px). */
export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  '2xl': 22,
  full: 999,
} as const;

/**
 * Fontes do web: Plus Jakarta Sans (display) e DM Sans (texto).
 * Enquanto os arquivos .ttf não forem linkados no projeto nativo,
 * fica `undefined` e cai na fonte do sistema.
 */
export const fonts = {
  display: undefined as string | undefined,
  body: undefined as string | undefined,
};

type Variant = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
> & {
  display?: boolean;
};

/** h1–h4 / .font-display no web: peso 800, tracking -0.02em. */
export const typography = {
  hero: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.72,
    display: true,
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.48,
    display: true,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    display: true,
  },
  h3: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '800',
    letterSpacing: -0.32,
    display: true,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: -0.28,
    display: true,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  tiny: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  micro: { fontSize: 10, lineHeight: 12, fontWeight: '700' },
} satisfies Record<string, Variant>;

export type TypographyVariant = keyof typeof typography;

/** Brilho neon (--shadow-corre-glow). No Android vira elevation. */
export function glow(
  color: string = palette.neon,
  intensity = 0.35,
): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOpacity: intensity,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 0 },
    },
    default: { elevation: 6, shadowColor: color },
  })!;
}

/** Largura máxima do conteúdo (max-w-md no web). */
export const layout = {
  maxWidth: 448,
  screenPadding: spacing[4],
  sectionGap: spacing[8],
  headerHeight: 56,
} as const;
