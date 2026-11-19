import { StyleSheet, View } from 'react-native';
import FileText from 'lucide-react-native/icons/file-text';
import { Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';

function receiptLabel(total: number) {
  if (total === 0) {
    return 'Nenhum comprovante';
  }
  return total === 1 ? '1 comprovante' : `${total} comprovantes`;
}

export function ReceiptCounter({ total }: { total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <FileText
        size={16}
        color={total ? colors.highlight : colors.mutedForeground}
      />
      <Text variant="small" tone={total ? 'highlight' : 'muted'}>
        {receiptLabel(total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
