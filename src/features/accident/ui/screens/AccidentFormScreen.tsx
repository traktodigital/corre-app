import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import { Button, Chip, InlineError, Input, Text } from '../../../../shared/ui';
import {
  ACCIDENT_APPS,
  maskDate,
  validateAccidentDate,
  type YesNo,
  type YesNoUnknown,
} from '../../domain';

const YES_NO: { value: YesNo; label: string }[] = [
  { value: 'yes', label: 'Sim' },
  { value: 'no', label: 'Não' },
];

const YES_NO_UNKNOWN: { value: YesNoUnknown; label: string }[] = [
  ...YES_NO,
  { value: 'unknown', label: 'Não sei' },
];

function toggle<T>(current: T | null, value: T): T | null {
  return current === value ? null : value;
}

export function AccidentFormScreen({
  navigation,
}: ScreenProps<'AccidentForm'>) {
  const [date, setDate] = useState('');
  const [working, setWorking] = useState<YesNo | null>(null);
  const [fracture, setFracture] = useState<YesNoUnknown | null>(null);
  const [apps, setApps] = useState<string[]>([]);
  const [includeCpf, setIncludeCpf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleApp(app: string) {
    setApps(current =>
      current.includes(app)
        ? current.filter(a => a !== app)
        : [...current, app],
    );
  }

  function next() {
    const invalid = validateAccidentDate(date, new Date());
    setError(invalid);
    if (invalid) {
      return;
    }
    navigation.navigate('AccidentConsent', {
      report: {
        date: date.trim() || null,
        working,
        fracture,
        apps,
        includeCpf,
      },
    });
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Text tone="muted">
          Ok, para te ajudar vamos precisar de algumas informações. Nada aqui é
          obrigatório.
        </Text>

        <Input
          label="Qual a data do acidente?"
          placeholder="dd/mm/aaaa"
          value={date}
          onChangeText={v => setDate(maskDate(v))}
          keyboardType="number-pad"
          maxLength={10}
        />

        <View style={styles.group}>
          <Text variant="small" style={styles.label}>
            Estava trabalhando na hora?
          </Text>
          <View style={styles.chips}>
            {YES_NO.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={working === option.value}
                onPress={() => setWorking(toggle(working, option.value))}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="small" style={styles.label}>
            Teve alguma fratura?
          </Text>
          <View style={styles.chips}>
            {YES_NO_UNKNOWN.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={fracture === option.value}
                onPress={() => setFracture(toggle(fracture, option.value))}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="small" style={styles.label}>
            Qual aplicativo você estava usando? Pode marcar mais de um.
          </Text>
          <View style={styles.chips}>
            {ACCIDENT_APPS.map(app => (
              <Chip
                key={app}
                label={app}
                selected={apps.includes(app)}
                onPress={() => toggleApp(app)}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="small" style={styles.label}>
            Mandar meu CPF na mensagem?
          </Text>
          <View style={styles.chips}>
            <Chip
              label="Sim, incluir o CPF"
              selected={includeCpf}
              onPress={() => setIncludeCpf(true)}
            />
            <Chip
              label="Não"
              selected={!includeCpf}
              onPress={() => setIncludeCpf(false)}
            />
          </View>
          <Text variant="small" tone="muted">
            Ajuda a 3B a analisar mais rápido, mas você decide.
          </Text>
        </View>

        {error ? <InlineError text={error} /> : null}
        <Button title="Análise gratuita" size="lg" fullWidth onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  group: { gap: 8 },
  label: { fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
