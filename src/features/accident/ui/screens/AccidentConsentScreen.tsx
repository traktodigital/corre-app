import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Clock, MapPinned, MessageCircle, Phone } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { Screen } from '../../../../shared/layout';
import { useTheme } from '../../../../shared/theme';
import {
  Button,
  Card,
  ErrorState,
  InlineError,
  ListSkeleton,
  Text,
  useDialog,
} from '../../../../shared/ui';
import { useSession } from '../../../auth';
import {
  fetchConsentText,
  fetchSender,
  recordThreeBConsent,
  recordThreeBLead,
} from '../../data/accidentRepository';
import { THREE_B, threeBMessage, threeBWhatsappUrl } from '../../domain';

export function AccidentConsentScreen({
  navigation,
  route,
}: ScreenProps<'AccidentConsent'>) {
  const { report } = route.params;
  const { user } = useSession();
  const { colors } = useTheme();
  const dialog = useDialog();
  const userId = user?.id ?? null;
  const sender = useQuery(userId ? `3b-sender:${userId}` : null, () =>
    fetchSender(userId!),
  );
  const consentText = useQuery('3b-consent-text', fetchConsentText);
  const [step, setStep] = useState<'consent' | 'ready'>('consent');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSaving(true);
    setError(null);
    try {
      await recordThreeBConsent('accepted');
      setStep('ready');
    } catch {
      setError(
        'Não deu pra registrar sua autorização agora. Confere a internet e tenta de novo.',
      );
    } finally {
      setSaving(false);
    }
  }

  function openWhatsapp() {
    const text = threeBMessage(report, {
      name: sender.data?.name ?? '',
      cpf: sender.data?.cpf ?? null,
      phone: sender.data?.phone ?? null,
      email: sender.data?.email ?? user?.email ?? null,
    });
    recordThreeBLead();
    Linking.openURL(threeBWhatsappUrl(text)).catch(() =>
      dialog(
        'Não deu pra abrir o WhatsApp',
        `Chama a 3B no WhatsApp ${THREE_B.phone} ou liga pra eles.`,
      ),
    );
  }

  function call() {
    Linking.openURL(`tel:+55${THREE_B.phone}`).catch(() =>
      dialog('Não deu pra abrir o telefone', `Liga para ${THREE_B.phone}.`),
    );
  }

  if (step === 'consent' && consentText.loading && !consentText.data) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  if (step === 'consent' && !consentText.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => consentText.reload()} />
      </Screen>
    );
  }

  if (step === 'consent') {
    return (
      <Screen>
        <View style={styles.page}>
          <Text variant="h1">Antes de enviar</Text>
          <Card>
            <Text>{consentText.data?.text}</Text>
          </Card>
          {error ? <InlineError text={error} /> : null}
          <View style={styles.actions}>
            <Button
              title="Concordo e continuar"
              size="lg"
              fullWidth
              loading={saving}
              onPress={accept}
            />
            <Button
              title="Cancelar"
              variant="outline"
              size="lg"
              fullWidth
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.page}>
        <Text variant="h1">Agora é com a 3B</Text>
        <Text tone="muted">
          Abre o WhatsApp com suas respostas prontas. É só enviar a mensagem.
        </Text>
        <Card style={styles.info}>
          <View style={styles.row}>
            <Clock size={18} color={colors.highlight} />
            <Text style={styles.flex}>
              {THREE_B.hours} O atendimento é de preferência pelo WhatsApp.
            </Text>
          </View>
          <View style={styles.row}>
            <MapPinned size={18} color={colors.highlight} />
            <Text style={styles.flex}>{THREE_B.address}</Text>
          </View>
        </Card>
        <View style={styles.actions}>
          <Button
            title="Abrir WhatsApp da 3B"
            size="lg"
            fullWidth
            icon={<MessageCircle size={20} color={colors.primaryForeground} />}
            onPress={openWhatsapp}
          />
          <Button
            title="Ligar para a 3B"
            variant="outline"
            size="lg"
            fullWidth
            icon={<Phone size={20} color={colors.foreground} />}
            onPress={call}
          />
          <Text variant="small" tone="muted">
            Na ligação, use o telefone normal. A 3B não atende chamada de
            WhatsApp.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  actions: { gap: 12 },
  info: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
});
