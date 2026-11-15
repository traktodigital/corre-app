import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { pickFiles } from '../../../../core/device/files';
import * as locationTracker from '../../../../core/device/location';
import type { LocalFile } from '../../../../core/device/types';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { useSession } from '../../../auth';
import {
  closeTrip,
  fetchOpenTrip,
  listDeliveryApps,
  saveEarning,
  uploadTripFile,
} from '../../data/tripRepository';
import {
  parseBrazilianNumber,
  parseOdometer,
  parseRideCount,
  validateEnd,
} from '../../domain';
import { PhotoField } from '../components/PhotoField';
import { ReceiptCounter } from '../components/ReceiptCounter';
import { tripQueryKeys } from '../queryKeys';

type EarningForm = { amount: string; rides: string; receipts: LocalFile[] };

const EMPTY_EARNING: EarningForm = { amount: '', rides: '', receipts: [] };

export function EndTripScreen({ navigation, route }: ScreenProps<'EndTrip'>) {
  const { jornadaId: tripId } = route.params;
  const { user } = useSession();
  const { colors } = useTheme();
  const openTripQuery = useQuery(
    user ? tripQueryKeys.openTrip(user.id) : null,
    fetchOpenTrip,
  );
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [odometer, setOdometer] = useState('');
  const [earnings, setEarnings] = useState<Record<string, EarningForm>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trip = openTripQuery.data;
  const appName = (id: string) => apps.data?.find(a => a.id === id)?.name ?? id;
  const earningFor = (appId: string): EarningForm =>
    earnings[appId] ?? EMPTY_EARNING;
  const updateEarning = (appId: string, patch: Partial<EarningForm>) =>
    setEarnings(current => ({
      ...current,
      [appId]: { ...earningFor(appId), ...patch },
    }));

  async function attach(appId: string) {
    const result = await pickFiles({ kinds: ['image', 'pdf'], multiple: true });
    if (result.status === 'error') {
      setError('Não deu pra abrir os arquivos.');
      return;
    }
    if (result.status === 'picked' && result.files.length) {
      updateEarning(appId, {
        receipts: [...earningFor(appId).receipts, ...result.files],
      });
    }
  }

  async function submit() {
    if (!user || !trip || !photo) {
      return;
    }
    setSubmitting(true);
    try {
      const tracker = await locationTracker.getState();
      const routePath = tracker?.file
        ? await uploadTripFile(user.id, tripId, 'trajeto', {
            uri: `file://${tracker.file}`,
            type: 'text/csv',
          }).catch(() => null)
        : null;
      const panelPath = await uploadTripFile(
        user.id,
        tripId,
        'painel-fim',
        photo,
      );
      for (const appId of trip.appIds) {
        const form = earningFor(appId);
        const receiptPaths = await Promise.all(
          form.receipts.map(file =>
            uploadTripFile(user.id, tripId, `comprovante-${appId}`, file),
          ),
        );
        await saveEarning(tripId, {
          appId,
          amount: parseBrazilianNumber(form.amount)!,
          rides: form.rides ? parseRideCount(form.rides) : null,
          receipts: receiptPaths,
        });
      }
      await closeTrip(tripId, {
        gpsKm: tracker?.tripId === tripId ? tracker.km : null,
        endOdometer: parseOdometer(odometer)!,
        endPanelPhoto: panelPath,
        routePath,
      });
      await locationTracker.stop();
      navigation.replace('TripSummary', { jornadaId: tripId });
    } catch {
      setError(
        'Não deu pra encerrar. Confere a internet e tenta de novo — o GPS continua contando.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function confirm() {
    if (!trip) {
      return;
    }
    const invalid = validateEnd({
      hasPhoto: !!photo,
      startOdometer: trip.startOdometer,
      endOdometer: odometer,
      earnings: trip.appIds.map(appId => ({
        app: appName(appId),
        amount: earningFor(appId).amount,
      })),
    });
    setError(invalid);
    if (invalid) {
      return;
    }
    const withoutReceipt = trip.appIds.filter(
      appId => earningFor(appId).receipts.length === 0,
    );
    if (withoutReceipt.length === 0) {
      return submit();
    }
    Alert.alert(
      'Falta comprovante',
      `${withoutReceipt
        .map(appName)
        .join(
          ', ',
        )} sem print ou PDF. Sem o comprovante, o ganho conta menos na comparação entre apps.`,
      [
        { text: 'Anexar', style: 'cancel' },
        { text: 'Encerrar assim', onPress: submit },
      ],
    );
  }

  if (trip === undefined && openTripQuery.loading) {
    return (
      <Screen>
        <ListSkeleton />
      </Screen>
    );
  }
  if (!trip || trip.id !== tripId) {
    return (
      <Screen>
        <ErrorState
          title="Essa jornada já foi encerrada"
          description="Volta pra aba Entregas pra ver o resumo."
          onRetry={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.section}>
        <Text variant="h2">1. Painel no fim do dia</Text>
        <PhotoField
          title="Foto do painel"
          hint="Com o odômetro aparecendo."
          photo={photo}
          onPhoto={setPhoto}
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          maxLength={7}
          placeholder={
            trip.startOdometer !== null
              ? `Abriu com ${trip.startOdometer}`
              : undefined
          }
        />
      </View>

      <View style={styles.section}>
        <Text variant="h2">2. Quanto cada app pagou hoje</Text>
        <Text variant="small" tone="muted">
          Manda o print ou o PDF do resumo de ganhos de cada app.
        </Text>
        {trip.appIds.map(appId => {
          const form = earningFor(appId);
          return (
            <Card key={appId} style={styles.app}>
              <Text variant="title">{appName(appId)}</Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Input
                    label="Ganho (R$)"
                    keyboardType="decimal-pad"
                    value={form.amount}
                    onChangeText={amount => updateEarning(appId, { amount })}
                    placeholder="0,00"
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Corridas"
                    keyboardType="number-pad"
                    value={form.rides}
                    onChangeText={rides => updateEarning(appId, { rides })}
                    maxLength={3}
                  />
                </View>
              </View>
              <View style={styles.rowBetween}>
                <ReceiptCounter total={form.receipts.length} />
                <Button
                  title="Anexar"
                  size="sm"
                  variant="outline"
                  icon={<Paperclip size={14} color={colors.foreground} />}
                  onPress={() => attach(appId)}
                />
              </View>
            </Card>
          );
        })}
      </View>

      {error ? <InlineError text={error} /> : null}
      <Button
        title="Encerrar e ver o resumo"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={submitting}
        onPress={confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  app: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flex: { flex: 1 },
});
