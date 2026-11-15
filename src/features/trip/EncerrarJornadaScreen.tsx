import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../shared/layout';
import {
  Button,
  Card,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../shared/ui';
import { useConsulta } from '../../shared/hooks/useQuery';
import { useTheme } from '../../shared/theme';
import { useSession } from '../auth';
import {
  buscarJornadaAberta,
  enviarArquivo,
  fecharJornada,
  listarApps,
  salvarGanho,
  type Arquivo,
} from './api';
import {
  CampoFoto,
  ContadorComprovantes,
  escolherComprovantes,
} from './componentes';
import { encerrarGps, estadoGps } from './gps';
import { numeroBr, odometroDe, validarEncerramento } from './regras';

type GanhoForm = { valor: string; corridas: string; comprovantes: Arquivo[] };

export function EncerrarJornadaScreen({
  navigation,
  route,
}: ScreenProps<'EndTrip'>) {
  const { jornadaId } = route.params;
  const { user } = useSession();
  const { colors } = useTheme();
  const jornada = useConsulta(
    user ? `jornada-aberta:${user.id}` : null,
    buscarJornadaAberta,
  );
  const apps = useConsulta('apps-entrega', listarApps);
  const [foto, setFoto] = useState<Arquivo | null>(null);
  const [odometro, setOdometro] = useState('');
  const [ganhos, setGanhos] = useState<Record<string, GanhoForm>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const j = jornada.dados;
  const nomeDoApp = (id: string) =>
    apps.dados?.find(a => a.id === id)?.nome ?? id;
  const ganhoDe = (app: string): GanhoForm =>
    ganhos[app] ?? { valor: '', corridas: '', comprovantes: [] };
  const mudar = (app: string, parte: Partial<GanhoForm>) =>
    setGanhos(g => ({ ...g, [app]: { ...ganhoDe(app), ...parte } }));

  async function anexar(app: string) {
    try {
      const novos = await escolherComprovantes();
      if (novos.length) {
        mudar(app, { comprovantes: [...ganhoDe(app).comprovantes, ...novos] });
      }
    } catch {
      setErro('Não deu pra abrir os arquivos.');
    }
  }

  async function enviar() {
    if (!user || !j || !foto) {
      return;
    }
    setEnviando(true);
    try {
      const gps = await estadoGps();
      const trajeto = gps?.arquivo
        ? await enviarArquivo(user.id, jornadaId, 'trajeto', {
            uri: `file://${gps.arquivo}`,
            tipo: 'text/csv',
          }).catch(() => null)
        : null;
      const painel = await enviarArquivo(
        user.id,
        jornadaId,
        'painel-fim',
        foto,
      );
      for (const app of j.apps) {
        const g = ganhoDe(app);
        const caminhos = await Promise.all(
          g.comprovantes.map(c =>
            enviarArquivo(user.id, jornadaId, `comprovante-${app}`, c),
          ),
        );
        await salvarGanho(jornadaId, {
          app,
          valor: numeroBr(g.valor)!,
          corridas: g.corridas ? odometroDe(g.corridas) : null,
          comprovantes: caminhos,
        });
      }
      await fecharJornada(jornadaId, {
        kmGps: gps?.jornadaId === jornadaId ? gps.km : null,
        odometroFim: odometroDe(odometro)!,
        fotoPainelFim: painel,
        trajetoPath: trajeto,
      });
      await encerrarGps();
      navigation.replace('TripSummary', { jornadaId });
    } catch {
      setErro(
        'Não deu pra encerrar. Confere a internet e tenta de novo — o GPS continua contando.',
      );
    } finally {
      setEnviando(false);
    }
  }

  function confirmar() {
    if (!j) {
      return;
    }
    const invalido = validarEncerramento({
      temFoto: !!foto,
      odometroInicio: j.odometro_inicio,
      odometroFim: odometro,
      valores: j.apps.map(a => ({
        app: nomeDoApp(a),
        valor: ganhoDe(a).valor,
      })),
    });
    setErro(invalido);
    if (invalido) {
      return;
    }
    const semComprovante = j.apps.filter(
      a => ganhoDe(a).comprovantes.length === 0,
    );
    if (semComprovante.length === 0) {
      return enviar();
    }
    Alert.alert(
      'Falta comprovante',
      `${semComprovante
        .map(nomeDoApp)
        .join(
          ', ',
        )} sem print ou PDF. Sem o comprovante, o ganho conta menos na comparação entre apps.`,
      [
        { text: 'Anexar', style: 'cancel' },
        { text: 'Encerrar assim', onPress: enviar },
      ],
    );
  }

  if (j === undefined && jornada.carregando) {
    return (
      <Screen>
        <ListSkeleton />
      </Screen>
    );
  }
  if (!j || j.id !== jornadaId) {
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
      <View style={styles.secao}>
        <Text variant="h2">1. Painel no fim do dia</Text>
        <CampoFoto
          titulo="Foto do painel"
          dica="Com o odômetro aparecendo."
          foto={foto}
          onFoto={setFoto}
        />
        <Input
          label="Km no odômetro"
          keyboardType="number-pad"
          value={odometro}
          onChangeText={setOdometro}
          maxLength={7}
          placeholder={
            j.odometro_inicio !== null
              ? `Abriu com ${j.odometro_inicio}`
              : undefined
          }
        />
      </View>

      <View style={styles.secao}>
        <Text variant="h2">2. Quanto cada app pagou hoje</Text>
        <Text variant="small" tone="muted">
          Manda o print ou o PDF do resumo de ganhos de cada app.
        </Text>
        {j.apps.map(app => {
          const g = ganhoDe(app);
          return (
            <Card key={app} style={styles.app}>
              <Text variant="title">{nomeDoApp(app)}</Text>
              <View style={styles.linha}>
                <View style={styles.flex}>
                  <Input
                    label="Ganho (R$)"
                    keyboardType="decimal-pad"
                    value={g.valor}
                    onChangeText={v => mudar(app, { valor: v })}
                    placeholder="0,00"
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Corridas"
                    keyboardType="number-pad"
                    value={g.corridas}
                    onChangeText={v => mudar(app, { corridas: v })}
                    maxLength={3}
                  />
                </View>
              </View>
              <View style={styles.linhaEntre}>
                <ContadorComprovantes total={g.comprovantes.length} />
                <Button
                  title="Anexar"
                  size="sm"
                  variant="outline"
                  icon={<Paperclip size={14} color={colors.foreground} />}
                  onPress={() => anexar(app)}
                />
              </View>
            </Card>
          );
        })}
      </View>

      {erro ? <InlineError text={erro} /> : null}
      <Button
        title="Encerrar e ver o resumo"
        size="lg"
        fullWidth
        loading={enviando}
        disabled={enviando}
        onPress={confirmar}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  secao: { gap: 10 },
  app: { gap: 10 },
  linha: { flexDirection: 'row', gap: 10 },
  linhaEntre: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flex: { flex: 1 },
});
