import { Linking, StyleSheet, View } from 'react-native';
import PhoneCall from 'lucide-react-native/icons/phone-call';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import { Button, Text, useDialog } from '../../../../shared/ui';

const LINES = [
  { number: '193', label: 'Bombeiros' },
  { number: '192', label: 'SAMU' },
] as const;

export function AccidentScreen({ navigation }: ScreenProps<'Accident'>) {
  const dialog = useDialog();

  function call(number: string) {
    Linking.openURL(`tel:${number}`).catch(() =>
      dialog('Não deu pra abrir o telefone', `Disca ${number} direto.`),
    );
  }

  return (
    <Screen>
      <View style={styles.page}>
        <Text tone="muted">
          Se você acabou de sofrer um acidente, chame o socorro pelo 193
          (Bombeiros) ou pelo SAMU (192).
        </Text>
        <View style={styles.lines}>
          {LINES.map(line => (
            <Button
              key={line.number}
              title={`Ligar ${line.number} · ${line.label}`}
              variant="destructive"
              size="lg"
              fullWidth
              icon={<PhoneCall size={20} color="#ffffff" />}
              onPress={() => call(line.number)}
            />
          ))}
        </View>

        <View style={styles.block}>
          <Text variant="h2">Depois do susto</Text>
          <Text tone="muted">
            Se você quer saber dos seus direitos depois de um acidente, a 3B
            Indenizações faz uma análise gratuita.
          </Text>
          <Button
            title="Saber meus direitos"
            size="lg"
            fullWidth
            onPress={() => navigation.navigate('AccidentForm')}
          />
          <Button
            title="Conhecer a 3B Indenizações"
            variant="ghost"
            fullWidth
            onPress={() => navigation.navigate('ThreeB')}
          />
        </View>

        <Text variant="small" tone="muted">
          A 3B não é seguro e não substitui o 192 nem o 193.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  lines: { gap: 12 },
  block: { gap: 12 },
});
