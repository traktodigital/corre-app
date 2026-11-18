import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import * as locationTracker from '../../../../core/device/location';
import type { LocalFile } from '../../../../core/device/types';
import {
  openSettings,
  type PermissionStatus,
} from '../../../../core/permissions';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Chip,
  InlineError,
  Input,
  Text,
  useDialog,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useSession } from '../../../auth';
import {
  listDeliveryApps,
  openTrip,
  saveStartPanelPhoto,
  uploadTripFile,
} from '../../data/tripRepository';
import { type Fuel, parseOdometer, validateStart } from '../../domain';
import { PhotoField } from '../components/PhotoField';
import { tripQueryKeys } from '../queryKeys';
import { prepareTracking } from '../useTripTracking';

const TANK_LEVELS = [
  { label: 'Reserva', value: 10 },
  { label: '1/4', value: 25 },
  { label: '1/2', value: 50 },
  { label: '3/4', value: 75 },
  { label: 'Cheio', value: 100 },
];

const NO_LOCATION_MESSAGE: Record<
  Exclude<PermissionStatus, 'granted'>,
  string
> = {
  blocked:
    'A localização do CORRE está bloqueada. Libera nos ajustes pra contar os km sozinho, ou segue que o km sai pelo odômetro.',
  denied: 'Sem a localização, o km do dia sai só pelo odômetro.',
  unavailable:
    'O GPS não está disponível neste aparelho. O km do dia sai só pelo odômetro.',
};

export function StartTripScreen({ navigation }: ScreenProps<'StartTrip'>) {
  const dialog = useDialog();
  const { user } = useSession();
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [fuel, setFuel] = useState<Fuel | null>(null);
  const [odometer, setOdometer] = useState('');
  const [tankLevel, setTankLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleApp(id: string) {
    setSelectedApps(current =>
      current.includes(id) ? current.filter(x => x !== id) : [...current, id],
    );
  }

  async function open(withTracking: boolean) {
    if (!user || !photo || !fuel) {
      return;
    }
    setSubmitting(true);
    try {
      const tripId = await openTrip({
        appIds: selectedApps,
        fuel,
        odometer: parseOdometer(odometer)!,
        tankLevel,
      });
      const path = await uploadTripFile(
        user.id,
        tripId,
        'painel-inicio',
        photo,
      );
      await saveStartPanelPhoto(tripId, path);
      if (withTracking) {
        await locationTracker.start(tripId);
      }
      navigation.goBack();
    } catch {
      setError(
        'Não deu pra abrir a jornada. Confere a internet e tenta de novo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function begin() {
    const invalid = validateStart({
      appIds: selectedApps,
      hasPhoto: !!photo,
      fuel,
      odometer,
    });
    setError(invalid);
    if (invalid) {
      return;
    }
    const status = await prepareTracking();
    if (status === 'granted') {
      return open(true);
    }
    dialog('Sem localização, sem km automático', NO_LOCATION_MESSAGE[status], [
      ...(status === 'blocked'
        ? [{ text: 'Abrir ajustes', onPress: openSettings }]
        : []),
      { text: 'Seguir sem GPS', onPress: () => open(false) },
    ]);
  }

  return (
    <Screen>
      <View style={styles.section}>
        <Text variant="h2">1. Em qual app você vai rodar agora?</Text>
        <Text variant="small" tone="muted">
          Pode marcar mais de um.
        </Text>
        <View style={styles.chips}>
          {(apps.data ?? []).map(a => (
            <Chip
              key={a.id}
              label={a.name}
              selected={selectedApps.includes(a.id)}
              onPress={() => toggleApp(a.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="h2">2. Painel da moto</Text>
        <PhotoField
          title="Foto do painel"
          hint="Com o odômetro e o marcador de combustível aparecendo."
          photo={photo}
          onPhoto={setPhoto}
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          placeholder="Ex.: 23450"
          maxLength={7}
        />
        <Text variant="small">Combustível</Text>
        <View style={styles.chips}>
          <Chip
            label="Gasolina"
            selected={fuel === 'gasoline'}
            onPress={() => setFuel('gasoline')}
          />
          <Chip
            label="Etanol"
            selected={fuel === 'ethanol'}
            onPress={() => setFuel('ethanol')}
          />
        </View>
        <Text variant="small">Tanque agora (opcional)</Text>
        <View style={styles.chips}>
          {TANK_LEVELS.map(level => (
            <Chip
              key={level.value}
              label={level.label}
              selected={tankLevel === level.value}
              onPress={() =>
                setTankLevel(tankLevel === level.value ? null : level.value)
              }
            />
          ))}
        </View>
      </View>

      {error ? <InlineError text={error} /> : null}
      <Button
        title="Começar jornada"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={submitting}
        onPress={begin}
      />
      <Text variant="tiny" tone="muted" style={styles.centered}>
        O CORRE usa sua localização só durante a jornada, pra contar os km.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  centered: { textAlign: 'center' },
});
