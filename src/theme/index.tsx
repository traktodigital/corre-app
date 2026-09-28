import { createContext, ReactNode, useContext, useMemo } from 'react';
import { darkColors, lightColors, ThemeColors } from './colors';
import { fonts, layout, radius, spacing, typography } from './tokens';

export * from './colors';
export * from './tokens';

export type ThemeMode = 'dark' | 'light';

export type Theme = {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  fonts: typeof fonts;
  layout: typeof layout;
};

function buildTheme(mode: ThemeMode): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    typography,
    fonts,
    layout,
  };
}

const ThemeContext = createContext<Theme>(buildTheme('dark'));

/**
 * O app do entregador é sempre escuro no web (AppShell força `.dark`),
 * então o padrão aqui também é 'dark'.
 */
export function ThemeProvider({
  mode = 'dark',
  children,
}: {
  mode?: ThemeMode;
  children: ReactNode;
}) {
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
