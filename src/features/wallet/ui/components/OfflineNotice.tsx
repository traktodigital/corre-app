import { StyleSheet, View } from 'react-native';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import { Text } from '../../../../shared/ui';
import { formatDateTime } from '../../../../shared/format';
import { alpha, palette, useTheme } from '../../../../shared/theme';

export function OfflineNotice({ syncedAt }: { syncedAt?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.notice,
        {
          borderColor: alpha(palette.warning, 0.4),
          backgroundColor: alpha(palette.warning, 0.1),
        },
      ]}
    >
      <WifiOff size={20} color={colors.warning} />
      <Text variant="small" style={styles.flex}>
        Sem internet. Mostrando a última sincronização em{' '}
        <Text variant="small" style={styles.bold}>
          {formatDateTime(syncedAt)}
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
});
