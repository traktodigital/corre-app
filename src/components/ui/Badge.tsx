import { StyleSheet, View } from 'react-native';
import { alpha, palette } from '../../theme';
import { Text } from './Text';

export type BadgeStatus = 'ativo' | 'a-vencer' | 'inadimplente' | 'associado';

const colorsByStatus: Record<BadgeStatus, string> = {
  ativo: palette.greenLight,
  associado: palette.greenLight,
  'a-vencer': palette.warning,
  inadimplente: palette.danger,
};

/** StatusBadge do web: pílula com fundo cor/15 e texto na cor. */
export function Badge({
  status,
  label,
}: {
  status: BadgeStatus;
  label: string;
}) {
  const color = colorsByStatus[status];
  return (
    <View style={[styles.base, { backgroundColor: alpha(color, 0.15) }]}>
      <Text variant="micro" style={[styles.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: { letterSpacing: 0.3 },
});
