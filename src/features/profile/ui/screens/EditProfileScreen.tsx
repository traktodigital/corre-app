import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Chip,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { maskPhone, type VehicleType, useSession } from '../../../auth';
import { fetchProfile, saveProfile } from '../../data/profileRepository';
import { validateProfile, vehicleHasPlate } from '../../domain/validation';

const vehicleOptions: { value: VehicleType; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'bike', label: 'Bike' },
  { value: 'carro', label: 'Carro' },
  { value: 'a_pe', label: 'A pé' },
];

export function EditProfileScreen({ navigation }: ScreenProps<'EditProfile'>) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const profileQuery = useQuery(userId ? `profile:${userId}` : null, () =>
    fetchProfile(userId!),
  );

  const [prefilled, setPrefilled] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('GO');
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile || prefilled) {
      return;
    }
    setName(profile.name ?? '');
    setPhone(profile.phone ?? '');
    setCity(profile.city ?? '');
    setStateCode(profile.state ?? 'GO');
    setVehicleType(profile.vehicleType ?? 'moto');
    setPlate(profile.plate ?? '');
    setPrefilled(true);
  }, [profileQuery.data, prefilled]);

  async function save() {
    if (!userId) {
      return;
    }
    const invalid = validateProfile({ name, phone, city });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveProfile(userId, {
        name,
        phone,
        city,
        state: stateCode,
        vehicleType,
        plate: vehicleHasPlate(vehicleType) ? plate : '',
      });
      navigation.goBack();
    } catch {
      setError('Não deu pra salvar agora. Tenta de novo em instantes.');
    } finally {
      setSaving(false);
    }
  }

  if (profileQuery.loading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (profileQuery.error && !profileQuery.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => profileQuery.reload()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Input
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Input
          label="Telefone"
          placeholder="(62) 9 9999-9999"
          value={phone}
          onChangeText={v => setPhone(maskPhone(v))}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Input
              label="Cidade"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.state}>
            <Input
              label="UF"
              value={stateCode}
              onChangeText={v => setStateCode(v.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="small" style={styles.semibold}>
            Como você roda?
          </Text>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {vehicleOptions.map(option => (
              <Chip
                key={option.value}
                label={option.label}
                selected={vehicleType === option.value}
                onPress={() => setVehicleType(option.value)}
              />
            ))}
          </View>
        </View>

        {vehicleHasPlate(vehicleType) ? (
          <Input
            label="Placa"
            placeholder="ABC1D23"
            value={plate}
            onChangeText={v => setPlate(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        ) : null}

        <Text variant="caption" tone="muted">
          E-mail e CPF não mudam por aqui. Precisa trocar? Fala com o suporte
          Sou Corre.
        </Text>

        {error ? <InlineError text={error} /> : null}

        <Button
          size="lg"
          title={saving ? 'Salvando...' : 'Salvar'}
          loading={saving}
          onPress={save}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  group: { gap: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  state: { width: 80 },
  semibold: { fontWeight: '600' },
});
