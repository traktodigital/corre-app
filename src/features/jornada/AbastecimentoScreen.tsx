import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  Chip,
  InlineError,
  Input,
  Text,
} from '../../components/ui';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';
import {
  buscarJornadaAberta,
  enviarArquivo,
  registrarAbastecimento,
  type Arquivo,
} from './api';
import { CampoFoto } from './componentes';
import {
  type Combustivel,
  numeroBr,
  odometroDe,
  validarAbastecimento,
} from './regras';

/** Abastecimento: cupom + odômetro + marcador (ADR-0005 §6.2). */
export function AbastecimentoScreen({
  navigation,
  route,
}: ScreenProps<'Abastecimento'>) {
  const { jornadaId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const jornada = useConsulta(
    user ? `jornada-aberta:${user.id}` : null,
    buscarJornadaAberta,
  );
  const [cupom, setCupom] = useState<Arquivo | null>(null);
  const [fotoOdometro, setFotoOdometro] = useState<Arquivo | null>(null);
  const [marcador, setMarcador] = useState<Arquivo | null>(null);
  const [escolhido, setEscolhido] = useState<Combustivel | null>(null);
  const combustivel = escolhido ?? jornada.dados?.combustivel ?? null;
  const [litros, setLitros] = useState('');
  const [valor, setValor] = useState('');
  const [odometro, setOdometro] = useState('');
  const [posto, setPosto] = useState('');
  const [insistiuCupom, setInsistiuCupom] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(semCupom: boolean) {
    const invalido = validarAbastecimento({
      litros,
      valor,
      odometro,
      combustivel,
      temFotoOdometro: !!fotoOdometro,
      temFotoMarcador: !!marcador,
    });
    setErro(invalido);
    if (invalido || !user || !combustivel || !fotoOdometro || !marcador) {
      return;
    }
    // O Ligeirin insiste no cupom uma vez e explica o porquê; depois respeita.
    if (!cupom && !semCupom) {
      setInsistiuCupom(true);
      return;
    }
    setEnviando(true);
    try {
      const [cCupom, cOdometro, cMarcador] = await Promise.all([
        cupom
          ? enviarArquivo(user.id, jornadaId, 'cupom', cupom)
          : Promise.resolve(null),
        enviarArquivo(user.id, jornadaId, 'odometro', fotoOdometro),
        enviarArquivo(user.id, jornadaId, 'marcador', marcador),
      ]);
      await registrarAbastecimento({
        jornadaId,
        combustivel,
        litros: numeroBr(litros)!,
        valorTotal: numeroBr(valor)!,
        odometro: odometroDe(odometro)!,
        posto,
        fotoCupom: cCupom,
        fotoOdometro: cOdometro,
        fotoMarcador: cMarcador,
      });
      navigation.goBack();
    } catch {
      setErro(
        'Não deu pra salvar o abastecimento. Confere a internet e tenta de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Screen>
      <CampoFoto
        titulo="Cupom fiscal"
        dica="O cupom do posto, com o valor e os litros."
        foto={cupom}
        onFoto={f => {
          setCupom(f);
          setInsistiuCupom(false);
        }}
      />
      {insistiuCupom && !cupom ? (
        <Card style={[styles.insiste, { borderColor: colors.warning }]}>
          <View style={styles.linha}>
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
            onPress={() => salvar(true)}
            disabled={enviando}
          />
        </Card>
      ) : null}
      <CampoFoto
        titulo="Odômetro"
        dica="O painel mostrando o km agora."
        foto={fotoOdometro}
        onFoto={setFotoOdometro}
      />
      <CampoFoto
        titulo="Marcador depois de abastecer"
        dica="O ponteiro ou as barrinhas do tanque."
        foto={marcador}
        onFoto={setMarcador}
      />

      <View style={styles.secao}>
        <Text variant="small">Combustível</Text>
        <View style={styles.chips}>
          <Chip
            label="Gasolina"
            selected={combustivel === 'gasolina'}
            onPress={() => setEscolhido('gasolina')}
          />
          <Chip
            label="Etanol"
            selected={combustivel === 'etanol'}
            onPress={() => setEscolhido('etanol')}
          />
        </View>
        <Input
          label="Valor pago (R$)"
          keyboardType="decimal-pad"
          value={valor}
          onChangeText={setValor}
          placeholder="Ex.: 30,00"
        />
        <Input
          label="Litros"
          keyboardType="decimal-pad"
          value={litros}
          onChangeText={setLitros}
          placeholder="Ex.: 5,12"
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometro}
          onChangeText={setOdometro}
          maxLength={7}
        />
        <Input
          label="Posto (opcional)"
          value={posto}
          onChangeText={setPosto}
          maxLength={120}
        />
      </View>

      {erro ? <InlineError text={erro} /> : null}
      <Button
        title="Salvar abastecimento"
        size="lg"
        fullWidth
        loading={enviando}
        disabled={enviando}
        onPress={() => salvar(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  insiste: { gap: 8, borderWidth: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
