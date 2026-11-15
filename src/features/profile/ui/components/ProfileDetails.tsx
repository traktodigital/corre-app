import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';

export type ProfileDetailRow = [label: string, value: string];

export function ProfileDetails({ rows }: { rows: ProfileDetailRow[] }) {
  const { colors } = useTheme();
  return (
    <Card padding={0}>
      {rows.map(([label, value], i) => (
        <View
          key={label}
          style={[
            styles.row,
            i > 0 && styles.divider,
            i > 0 && { borderTopColor: colors.border },
          ]}
        >
          <Text variant="small" tone="muted">
            {label}
          </Text>
          <Text variant="small" style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  divider: { borderTopWidth: 1 },
  value: { flexShrink: 1, fontWeight: '600' },
});
