import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import { Button, Chip, InlineError, Input, Text } from '../../components/ui';
import { useConsulta } from '../../lib/useConsulta';
import { useAuth } from '../auth/AuthProvider';
import {
  abrirJornada,
  enviarArquivo,
  listarApps,
  salvarFotoPainelInicio,
  type Arquivo,
} from './api';
import { CampoFoto } from './componentes';
import { abrirAjustes, iniciarGps, pedirPermissaoGps } from './gps';
import { type Combustivel, odometroDe, validarInicio } from './regras';

const TANQUE = [
  { rotulo: 'Reserva', valor: 10 },
  { rotulo: '1/4', valor: 25 },
  { rotulo: '1/2', valor: 50 },
  { rotulo: '3/4', valor: 75 },
  { rotulo: 'Cheio', valor: 100 },
];

/** Abertura da jornada: apps do dia + foto do painel. O GPS liga sozinho no fim. */
export function IniciarJornadaScreen({
  navigation,
}: ScreenProps<'IniciarJornada'>) {
  const { user } = useAuth();
  const apps = useConsulta('apps-entrega', listarApps);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [foto, setFoto] = useState<Arquivo | null>(null);
  const [combustivel, setCombustivel] = useState<Combustivel | null>(null);
  const [odometro, setOdometro] = useState('');
  const [tanque, setTanque] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function alternar(id: string) {
    setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]));
  }

  async function abrir(comGps: boolean) {
    if (!user || !foto || !combustivel) {
      return;
    }
    setEnviando(true);
    try {
      const id = await abrirJornada({
        apps: marcados,
        combustivel,
        odometro: odometroDe(odometro)!,
        nivelTanque: tanque,
      });
      const caminho = await enviarArquivo(user.id, id, 'painel-inicio', foto);
      await salvarFotoPainelInicio(id, caminho);
      if (comGps) {
        // Falhou? A aba Entregas mostra "GPS parado" com botão pra tentar de novo.
        await iniciarGps(id).catch(() => undefined);
      }
      navigation.goBack();
    } catch {
      setErro(
        'Não deu pra abrir a jornada. Confere a internet e tenta de novo.',
      );
    } finally {
      setEnviando(false);
    }
  }

  async function comecar() {
    const invalido = validarInicio({
      apps: marcados,
      temFoto: !!foto,
      combustivel,
      odometro,
    });
    setErro(invalido);
    if (invalido) {
      return;
    }
    const p = await pedirPermissaoGps();
    if (p === 'permitido') {
      return abrir(true);
    }
    Alert.alert(
      'Sem localização, sem km automático',
      p === 'bloqueado'
        ? 'A localização do CORRE está bloqueada. Libera nos ajustes pra contar os km sozinho, ou segue que o km sai pelo odômetro.'
        : 'Sem a localização, o km do dia sai só pelo odômetro.',
      [
        ...(p === 'bloqueado'
          ? [{ text: 'Abrir ajustes', onPress: abrirAjustes }]
          : []),
        { text: 'Seguir sem GPS', onPress: () => abrir(false) },
      ],
    );
  }

  return (
    <Screen>
      <View style={styles.secao}>
        <Text variant="h2">1. Em qual app você vai rodar agora?</Text>
        <Text variant="small" tone="muted">
          Pode marcar mais de um.
        </Text>
        <View style={styles.chips}>
          {(apps.dados ?? []).map(a => (
            <Chip
              key={a.id}
              label={a.nome}
              selected={marcados.includes(a.id)}
              onPress={() => alternar(a.id)}
            />
          ))}
        </View>
      </View>

      <View style={styles.secao}>
        <Text variant="h2">2. Painel da moto</Text>
        <CampoFoto
          titulo="Foto do painel"
          dica="Com o odômetro e o marcador de combustível aparecendo."
          foto={foto}
          onFoto={setFoto}
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometro}
          onChangeText={setOdometro}
          placeholder="Ex.: 23450"
          maxLength={7}
        />
        <Text variant="small">Combustível</Text>
        <View style={styles.chips}>
          <Chip
            label="Gasolina"
            selected={combustivel === 'gasolina'}
            onPress={() => setCombustivel('gasolina')}
          />
          <Chip
            label="Etanol"
            selected={combustivel === 'etanol'}
            onPress={() => setCombustivel('etanol')}
          />
        </View>
        <Text variant="small">Tanque agora (opcional)</Text>
        <View style={styles.chips}>
          {TANQUE.map(t => (
            <Chip
              key={t.valor}
              label={t.rotulo}
              selected={tanque === t.valor}
              onPress={() => setTanque(tanque === t.valor ? null : t.valor)}
            />
          ))}
        </View>
      </View>

      {erro ? <InlineError text={erro} /> : null}
      <Button
        title="Começar jornada"
        size="lg"
        fullWidth
        loading={enviando}
        disabled={enviando}
        onPress={comecar}
      />
      <Text variant="tiny" tone="muted" style={styles.centro}>
        O CORRE usa sua localização só durante a jornada, pra contar os km.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  centro: { textAlign: 'center' },
});
