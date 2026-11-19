import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { maskCpf, onlyDigits } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { alpha, palette, useTheme } from '../../../../shared/theme';
import {
  maskPhone,
  nameWarning,
  type VehicleType,
  useSession,
} from '../../../auth';
import { fetchProfile } from '../../../profile';
import {
  fetchActiveAssociations,
  fetchLatestMembershipRequest,
  submitMembershipRequest,
} from '../../data/walletRepository';
import { validateMembershipRequest } from '../../domain';

const vehicleOptions: { value: VehicleType; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'bike', label: 'Bike' },
  { value: 'carro', label: 'Carro' },
  { value: 'a_pe', label: 'A pé' },
];

export function MembershipRequestScreen({
  navigation,
}: ScreenProps<'MembershipRequest'>) {
  const { colors, radius } = useTheme();
  const { user } = useSession();
  const userId = user?.id ?? null;

  const associationsQuery = useQuery(
    'active-associations',
    fetchActiveAssociations,
  );
  const requestQuery = useQuery(
    userId ? `membership-request:${userId}` : null,
    () => fetchLatestMembershipRequest(userId!),
  );

  const [associationId, setAssociationId] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [plate, setPlate] = useState('');
  const [acceptedBylaws, setAcceptedBylaws] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetchProfile(userId)
      .then(profile => {
        if (!profile) {
          return;
        }
        setName(v => v || profile.name || '');
        setCpf(v => v || maskCpf(profile.cpf ?? ''));
        setPhone(v => v || profile.phone || '');
        setCity(v => v || profile.city || '');
        setStateCode(v => profile.state || v);
        if (profile.vehicleType) {
          setVehicleType(profile.vehicleType);
        }
        setPlate(v => v || profile.plate || '');
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const list = associationsQuery.data ?? [];
    if (!associationId && list.length > 0) {
      setAssociationId(list[0].id);
    }
    const selected = list.find(a => a.id === associationId);
    if (selected?.state) {
      setStateCode(v => v || selected.state || '');
    }
  }, [associationsQuery.data, associationId]);

  async function submit() {
    if (!userId) {
      return;
    }
    const invalid = validateMembershipRequest({
      associationId,
      name,
      cpf,
      phone,
      city,
      acceptedBylaws,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitMembershipRequest(userId, {
        associationId,
        name,
        cpf: onlyDigits(cpf),
        phone,
        city,
        state: stateCode,
        vehicleType,
        plate,
      });
      navigation.goBack();
    } catch {
      setError('Não deu pra enviar agora. Tenta de novo em instantes.');
    } finally {
      setSubmitting(false);
    }
  }

  if (associationsQuery.loading || requestQuery.loading) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  if (associationsQuery.error && !associationsQuery.data) {
    return (
      <Screen>
        <ErrorState
          title="Não deu pra abrir a filiação"
          onRetry={() => associationsQuery.reload()}
        />
      </Screen>
    );
  }

  if (requestQuery.data?.status === 'pending') {
    return (
      <Screen>
        <EmptyState
          icon={ClipboardCheck}
          title="Seu pedido está na fila"
          description="A diretoria vai analisar. Enquanto isso, aproveite os benefícios abertos do clube."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const associations = associationsQuery.data ?? [];

  return (
    <Screen>
      <View>
        <Text variant="h1">Filie-se</Text>
        <Text variant="small" tone="muted">
          Carteirinha digital, benefício exclusivo e apoio da diretoria. A
          associação analisa e aprova o seu pedido.
        </Text>
      </View>

      <View style={styles.form}>
        {associations.length > 1 ? (
          <View style={styles.group}>
            <Text variant="small" style={styles.semibold}>
              Associação
            </Text>
            <View style={styles.chips}>
              {associations.map(a => (
                <Chip
                  key={a.id}
                  label={a.acronym}
                  selected={associationId === a.id}
                  onPress={() => setAssociationId(a.id)}
                />
              ))}
            </View>
          </View>
        ) : associations.length === 1 ? (
          <Text variant="small">
            Associação:{' '}
            <Text variant="small" tone="highlight" style={styles.bold}>
              {associations[0].acronym} — {associations[0].name}
            </Text>
          </Text>
        ) : (
          <InlineError text="Nenhuma associação aberta pra filiação agora." />
        )}

        <Input
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
        />
        {nameWarning(name) ? (
          <Text variant="caption" tone="muted">
            {nameWarning(name)}
          </Text>
        ) : null}
        <Input
          label="CPF"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={v => setCpf(maskCpf(v))}
          keyboardType="number-pad"
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
          <View style={styles.stateField}>
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
            {vehicleOptions.map(v => (
              <Chip
                key={v.value}
                label={v.label}
                selected={vehicleType === v.value}
                onPress={() => setVehicleType(v.value)}
              />
            ))}
          </View>
        </View>

        {vehicleType === 'moto' || vehicleType === 'carro' ? (
          <Input
            label="Placa"
            placeholder="ABC1D23"
            value={plate}
            onChangeText={v => setPlate(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        ) : null}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedBylaws }}
          onPress={() => setAcceptedBylaws(v => !v)}
          style={styles.consent}
        >
          <View
            style={[
              styles.checkbox,
              { borderRadius: radius.sm },
              acceptedBylaws
                ? {
                    borderColor: colors.highlight,
                    backgroundColor: alpha(palette.green, 0.2),
                  }
                : { borderColor: colors.border },
            ]}
          >
            {acceptedBylaws ? (
              <Check size={14} color={colors.highlight} />
            ) : null}
          </View>
          <Text variant="small" style={styles.flex}>
            Li e aceito o estatuto da associação e autorizo o uso dos meus dados
            para a filiação.
          </Text>
        </Pressable>

        {error ? <InlineError text={error} /> : null}

        <Button
          size="lg"
          title={submitting ? 'Enviando...' : 'Pedir filiação'}
          loading={submitting}
          disabled={associations.length === 0}
          onPress={submit}
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
  stateField: { width: 80 },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
