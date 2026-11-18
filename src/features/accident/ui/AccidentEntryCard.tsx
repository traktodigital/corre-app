import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bandage } from 'lucide-react-native';
import type { RootNav } from '../../../app/navigation';
import { useQuery } from '../../../shared/hooks/useQuery';
import { useTheme } from '../../../shared/theme';
import { Button, Card, Text } from '../../../shared/ui';
import { isThreeBRouteEnabled } from '../data/accidentRepository';

export const THREE_B_FLAG_KEY = 'flag:rota_3b';

export function AccidentEntryCard() {
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const enabled = useQuery(THREE_B_FLAG_KEY, isThreeBRouteEnabled);

  if (!enabled.data) {
    return null;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Bandage size={20} color={colors.highlight} />
        <Text variant="h2">Sofri acidente</Text>
      </View>
      <Text tone="muted">
        Depois do socorro, veja de graça quais benefícios e indenizações você
        pode receber, com a 3B Indenizações.
      </Text>
      <Button
        title="Saber meus direitos"
        variant="outline"
        fullWidth
        onPress={() => navigation.navigate('Accident')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
