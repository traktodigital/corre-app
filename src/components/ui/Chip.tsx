import { Pressable, StyleSheet } from 'react-native';
import { alpha, palette, useTheme } from '../../theme';
import { Text } from './Text';

/** Chip selecionável (seletor "Como você roda?" do web). */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.base,
        { borderRadius: radius.md },
        selected
          ? {
              borderColor: colors.highlight,
              backgroundColor: alpha(palette.green, 0.15),
            }
          : { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <Text
        variant="small"
        tone={selected ? 'highlight' : 'default'}
        style={styles.label}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 12,
  },
  label: { fontWeight: '700' },
});
