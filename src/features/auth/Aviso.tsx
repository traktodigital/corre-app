import { StyleSheet, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { Text } from '../../components/ui';
import { alpha, palette, useTheme } from '../../theme';

/** Aviso de sucesso inline (substitui o toast verde do web). */
export function Aviso({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.box,
        {
          borderRadius: radius['2xl'],
          borderColor: alpha(palette.greenLight, 0.4),
          backgroundColor: alpha(palette.greenLight, 0.1),
        },
      ]}
    >
      <CheckCircle2 size={20} color={colors.success} />
      <Text variant="small" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 12, borderWidth: 1, padding: 16 },
  flex: { flex: 1 },
});
