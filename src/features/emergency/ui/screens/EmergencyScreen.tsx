import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import MapPin from 'lucide-react-native/icons/map-pin';
import MapPinOff from 'lucide-react-native/icons/map-pin-off';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import MessageSquare from 'lucide-react-native/icons/message-square';
import PhoneCall from 'lucide-react-native/icons/phone-call';
import UserRound from 'lucide-react-native/icons/user-round';
import type { ScreenProps } from '../../../../app/navigation';
import {
  getLastLocation,
  type LastLocation,
} from '../../../../core/device/location';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { Screen } from '../../../../shared/layout';
import { palette, useTheme } from '../../../../shared/theme';
import { Button, Card, Text, useDialog } from '../../../../shared/ui';
import { AccidentEntryCard } from '../../../accident';
import { firstName, maskPhone, useSession } from '../../../auth';
import {
  fetchEmergencyContact,
  logEmergencyEvent,
  startEmergency,
} from '../../data/emergencyRepository';
import {
  EMERGENCY_LINES,
  emergencyMessage,
  smsUrl,
  whatsappUrl,
  type EmergencyEvent,
} from '../../domain';

export function EmergencyScreen({ navigation }: ScreenProps<'Emergency'>) {
  const { user } = useSession();
  const { colors } = useTheme();
  const dialog = useDialog();
  const userId = user?.id ?? null;
  const contactQuery = useQuery(
    userId ? `emergency-contact:${userId}` : null,
    () => fetchEmergencyContact(userId!),
  );
  const [position, setPosition] = useState<LastLocation | null | undefined>(
    undefined,
  );
  const emergencyId = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let alive = true;
    getLastLocation().then(found => {
      if (!alive) {
        return;
      }
      setPosition(found);
      if (userId) {
        emergencyId.current = startEmergency(found);
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  function log(event: Exclude<EmergencyEvent, 'triggered'>) {
    emergencyId.current?.then(id => (id ? logEmergencyEvent(id, event) : null));
  }

  function call(number: string, event: Exclude<EmergencyEvent, 'triggered'>) {
    log(event);
    Linking.openURL(`tel:${number}`).catch(() =>
      dialog('Não deu pra abrir o telefone', `Disca ${number} direto.`),
    );
  }

  const contact = contactQuery.data;

  function notify(channel: 'whatsapp' | 'sms') {
    if (!contact) {
      return;
    }
    const text = emergencyMessage(
      firstName(user),
      position ?? null,
      new Date(),
    );
    const url =
      channel === 'whatsapp'
        ? whatsappUrl(contact.phone, text)
        : smsUrl(
            contact.phone,
            text,
            Platform.OS === 'ios' ? 'ios' : 'android',
          );
    log('notifiedContact');
    Linking.openURL(url).catch(() =>
      dialog(
        'Não deu pra abrir',
        `Liga direto pro seu contato: ${maskPhone(contact.phone)}.`,
      ),
    );
  }

  function end() {
    log('ended');
    navigation.goBack();
  }

  return (
    <Screen>
      <View style={styles.page}>
        <View style={styles.head}>
          <Text variant="h1">Emergência acionada</Text>
          <Text tone="muted">
            O CORRE não chama o socorro por você. Se for grave, liga agora.
          </Text>
        </View>

        <View style={styles.lines}>
          {EMERGENCY_LINES.map(line => (
            <Button
              key={line.number}
              title={`Ligar ${line.number} · ${line.label}`}
              variant="destructive"
              size="lg"
              fullWidth
              icon={<PhoneCall size={20} color="#ffffff" />}
              onPress={() => call(line.number, line.event)}
            />
          ))}
        </View>

        <AccidentEntryCard />

        {userId ? (
          <Card style={styles.card}>
            <View style={styles.row}>
              <UserRound size={20} color={colors.highlight} />
              <Text variant="h2">
                {contact ? `Avisar ${contact.name}` : 'Contato de emergência'}
              </Text>
            </View>
            {contact ? (
              <>
                <Text tone="muted">
                  Abre o seu WhatsApp ou SMS com a mensagem e a sua localização
                  prontas. É só enviar.
                </Text>
                <Button
                  title="Avisar pelo WhatsApp"
                  size="lg"
                  fullWidth
                  icon={
                    <MessageCircle size={20} color={colors.primaryForeground} />
                  }
                  onPress={() => notify('whatsapp')}
                />
                <Button
                  title="Avisar por SMS"
                  variant="outline"
                  size="lg"
                  fullWidth
                  icon={<MessageSquare size={20} color={colors.foreground} />}
                  onPress={() => notify('sms')}
                />
              </>
            ) : contactQuery.loading ? (
              <Text tone="muted">Carregando seu contato…</Text>
            ) : (
              <>
                <Text tone="muted">
                  Você ainda não cadastrou ninguém pra avisar.
                </Text>
                <Button
                  title="Cadastrar contato"
                  variant="outline"
                  fullWidth
                  onPress={() => navigation.navigate('EmergencyContact')}
                />
              </>
            )}
          </Card>
        ) : null}

        <View style={styles.row}>
          {position ? (
            <MapPin size={18} color={colors.highlight} />
          ) : (
            <MapPinOff size={18} color={palette.danger} />
          )}
          <Text variant="small" tone="muted" style={styles.flex}>
            {position === undefined
              ? 'Pegando sua localização…'
              : position
              ? `Localização pega${
                  position.accuracy
                    ? ` (cerca de ${Math.round(position.accuracy)} m)`
                    : ''
                }. Vai junto no aviso.`
              : 'Sem localização agora. O 192 e o 193 funcionam mesmo sem internet.'}
          </Text>
        </View>

        <Button
          title="Estou bem, encerrar"
          variant="ghost"
          fullWidth
          onPress={end}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20 },
  head: { gap: 8 },
  lines: { gap: 12 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
