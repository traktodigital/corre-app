import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import type { LocalFile } from '../../../../core/device/types';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  Chip,
  InlineError,
  Input,
  Text,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { useSession } from '../../../auth';
import {
  createRefuel,
  fetchOpenTrip,
  uploadTripFile,
} from '../../data/tripRepository';
import {
  type Fuel,
  parseBrazilianNumber,
  parseOdometer,
  validateRefuel,
} from '../../domain';
import { PhotoField } from '../components/PhotoField';
import { tripQueryKeys } from '../queryKeys';

export function RefuelScreen({ navigation, route }: ScreenProps<'Refuel'>) {
  const { jornadaId: tripId } = route.params;
  const { user } = useSession();
  const { colors } = useTheme();
  const openTripQuery = useQuery(
    user ? tripQueryKeys.openTrip(user.id) : null,
    fetchOpenTrip,
  );
  const [receipt, setReceipt] = useState<LocalFile | null>(null);
  const [odometerPhoto, setOdometerPhoto] = useState<LocalFile | null>(null);
  const [gauge, setGauge] = useState<LocalFile | null>(null);
  const [chosenFuel, setChosenFuel] = useState<Fuel | null>(null);
  const fuel = chosenFuel ?? openTripQuery.data?.fuel ?? null;
  const [liters, setLiters] = useState('');
  const [price, setPrice] = useState('');
  const [odometer, setOdometer] = useState('');
  const [station, setStation] = useState('');
  const [askedForReceipt, setAskedForReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save(withoutReceipt: boolean) {
    const invalid = validateRefuel({
      liters,
      price,
      odometer,
      fuel,
      hasOdometerPhoto: !!odometerPhoto,
      hasGaugePhoto: !!gauge,
    });
    setError(invalid);
    if (invalid || !user || !fuel || !odometerPhoto || !gauge) {
      return;
    }

    if (!receipt && !withoutReceipt) {
      setAskedForReceipt(true);
      return;
    }
    setSubmitting(true);
    try {
      const [receiptPath, odometerPath, gaugePath] = await Promise.all([
        receipt
          ? uploadTripFile(user.id, tripId, 'cupom', receipt)
          : Promise.resolve(null),
        uploadTripFile(user.id, tripId, 'odometro', odometerPhoto),
        uploadTripFile(user.id, tripId, 'marcador', gauge),
      ]);
      await createRefuel({
        tripId,
        fuel,
        liters: parseBrazilianNumber(liters)!,
        totalPrice: parseBrazilianNumber(price)!,
        odometer: parseOdometer(odometer)!,
        station,
        receiptPhoto: receiptPath,
        odometerPhoto: odometerPath,
        gaugePhoto: gaugePath,
      });
      navigation.goBack();
    } catch {
      setError(
        'Não deu pra salvar o abastecimento. Confere a internet e tenta de novo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <PhotoField
        title="Cupom fiscal"
        hint="O cupom do posto, com o valor e os litros."
        photo={receipt}
        onPhoto={file => {
          setReceipt(file);
          setAskedForReceipt(false);
        }}
      />
      {askedForReceipt && !receipt ? (
        <Card style={[styles.nudge, { borderColor: colors.warning }]}>
          <View style={styles.row}>
            <Receipt size={18} color={colors.warning} />
            <Text variant="title">Sem o cupom, rapaz?</Text>
          </View>
          <Text variant="small">
            É o cupom que transforma o abastecimento em dado de verdade. Com ele
            dá pra saber o preço real do posto e pegar consumo fora do normal na
            sua moto. Pede pro frentista, leva 10 segundos.
          </Text>
          <Button
            title="Registrar sem cupom"
            variant="ghost"
            size="sm"
            onPress={() => save(true)}
            disabled={submitting}
          />
        </Card>
      ) : null}
      <PhotoField
        title="Odômetro"
        hint="O painel mostrando o km agora."
        photo={odometerPhoto}
        onPhoto={setOdometerPhoto}
      />
      <PhotoField
        title="Marcador depois de abastecer"
        hint="O ponteiro ou as barrinhas do tanque."
        photo={gauge}
        onPhoto={setGauge}
      />

      <View style={styles.section}>
        <Text variant="small">Combustível</Text>
        <View style={styles.chips}>
          <Chip
            label="Gasolina"
            selected={fuel === 'gasoline'}
            onPress={() => setChosenFuel('gasoline')}
          />
          <Chip
            label="Etanol"
            selected={fuel === 'ethanol'}
            onPress={() => setChosenFuel('ethanol')}
          />
        </View>
        <Input
          label="Valor pago (R$)"
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          placeholder="Ex.: 30,00"
        />
        <Input
          label="Litros"
          keyboardType="decimal-pad"
          value={liters}
          onChangeText={setLiters}
          placeholder="Ex.: 5,12"
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometer}
          onChangeText={setOdometer}
          maxLength={7}
        />
        <Input
          label="Posto (opcional)"
          value={station}
          onChangeText={setStation}
          maxLength={120}
        />
      </View>

      {error ? <InlineError text={error} /> : null}
      <Button
        title="Salvar abastecimento"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={submitting}
        onPress={() => save(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nudge: { gap: 8, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
