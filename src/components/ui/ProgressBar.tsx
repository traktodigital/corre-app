import { StyleSheet, View } from 'react-native';
import { alpha, glow, palette, useTheme } from '../../theme';

/** h-2 rounded-full bg-white/10 com barra neon brilhante. */
export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <View
      style={[styles.track, { backgroundColor: alpha(palette.white, 0.1) }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: colors.highlight },
          glow(colors.highlight, 0.6),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
