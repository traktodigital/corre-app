import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { maskPhone, useSession } from '../../../auth';
import {
  fetchEmergencyContact,
  saveEmergencyContact,
} from '../../data/emergencyRepository';
import { validateContact } from '../../domain';

export function EmergencyContactScreen({
  navigation,
}: ScreenProps<'EmergencyContact'>) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const contactQuery = useQuery(
    userId ? `emergency-contact:${userId}` : null,
    () => fetchEmergencyContact(userId!),
  );
  const [prefilled, setPrefilled] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefilled || contactQuery.loading) {
      return;
    }
    const contact = contactQuery.data;
    if (contact) {
      setName(contact.name);
      setPhone(maskPhone(contact.phone));
    }
    setPrefilled(true);
  }, [contactQuery.data, contactQuery.loading, prefilled]);

  async function save() {
    if (!userId) {
      return;
    }
    const invalid = validateContact({ name, phone });
    setError(invalid);
    if (invalid) {
      return;
    }
    setSaving(true);
    try {
      await saveEmergencyContact(userId, { name, phone });
      await contactQuery.reload(true);
      navigation.goBack();
    } catch {
      setError('Não deu pra salvar agora. Tenta de novo em instantes.');
    } finally {
      setSaving(false);
    }
  }

  if (contactQuery.loading && !prefilled) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Text tone="muted">
          Quem a gente ajuda você a avisar quando você segura o botão SOS. Esse
          contato só aparece pra você.
        </Text>
        <Input
          label="Nome"
          placeholder="Ex.: Maria (mãe)"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <Input
          label="Telefone com DDD"
          placeholder="(62) 9 9999-9999"
          value={phone}
          onChangeText={v => setPhone(maskPhone(v))}
          keyboardType="phone-pad"
        />
        {error ? <InlineError text={error} /> : null}
        <Button
          title="Salvar contato"
          size="lg"
          fullWidth
          loading={saving}
          onPress={save}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
});
