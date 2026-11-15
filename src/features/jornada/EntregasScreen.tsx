import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bike, Fuel, MapPinOff, Square } from 'lucide-react-native';
import type { RootNav } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../components/ui';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';
import { buscarJornadaAberta, listarApps, resumoHoje } from './api';
import { ResumoDia } from './componentes';
import { estadoGps, iniciarGps, pedirPermissaoGps } from './gps';
import { duracao, formatarKm } from './regras';

/** Hora atual que anda sozinha (pro "há 1h 12min"). */
function useAgora(intervaloMs: number) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

/** Aba Entregas: a jornada do dia é a porta de entrada do app (ADR-0005). */
export function EntregasScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const { user, sairDoModoVisitante } = useAuth();
  const uid = user?.id ?? null;

  const jornada = useConsulta(
    uid ? `jornada-aberta:${uid}` : null,
    buscarJornadaAberta,
  );
  const hoje = useConsulta(uid ? `resumo-hoje:${uid}` : null, resumoHoje);
  const apps = useConsulta('apps-entrega', listarApps);
  const aberta = jornada.dados ?? null;
  const gps = useConsulta(aberta ? `gps:${aberta.id}` : null, estadoGps, {
    intervaloMs: 5000,
  });
  const agora = useAgora(30_000);
  const [gpsParado, setGpsParado] = useState(false);
  const retomou = useRef<string | null>(null);

  // Jornada aberta no banco mas GPS parado (iOS fechou o app, celular
  // reiniciou): retoma uma vez — a soma continua, o intervalo vira buraco.
  useEffect(() => {
    if (
      !aberta ||
      gps.carregando ||
      gps.dados !== null ||
      retomou.current === aberta.id
    ) {
      return;
    }
    retomou.current = aberta.id;
    iniciarGps(aberta.id)
      .then(() => {
        setGpsParado(false);
        return gps.recarregar(true);
      })
      .catch(() => setGpsParado(true));
  }, [aberta, gps]);

  async function ligarGps() {
    if (!aberta) {
      return;
    }
    const p = await pedirPermissaoGps();
    if (p !== 'permitido') {
      return;
    }
    try {
      await iniciarGps(aberta.id);
      setGpsParado(false);
      await gps.recarregar(true);
    } catch {
      setGpsParado(true);
    }
  }

  const nomeDoApp = (id: string) =>
    apps.dados?.find(a => a.id === id)?.nome ?? id;

  if (!uid) {
    return (
      <Screen>
        <EmptyState
          icon={Bike}
          title="Sua jornada do dia"
          description="Entra na sua conta pra contar os km, o abastecimento e quanto cada app pagou."
          action={<Button title="Entrar" onPress={sairDoModoVisitante} />}
        />
      </Screen>
    );
  }

  if (jornada.dados === undefined && jornada.carregando) {
    return (
      <Screen>
        <ListSkeleton />
      </Screen>
    );
  }

  if (jornada.erro && jornada.dados === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => jornada.recarregar()} />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() =>
        Promise.all([
          jornada.recarregar(true),
          hoje.recarregar(true),
          gps.recarregar(true),
        ])
      }
    >
      {aberta ? (
        <Card glowing style={styles.cartao}>
          <Text variant="caption" tone="highlight">
            Jornada em andamento
          </Text>
          <Text variant="hero">{formatarKm(gps.dados?.km ?? 0)}</Text>
          <Text variant="small" tone="muted">
            {`${duracao(
              agora - new Date(aberta.iniciada_em).getTime(),
            )} rodando · ${aberta.apps.map(nomeDoApp).join(', ')}`}
          </Text>
          {gpsParado || gps.dados === null ? (
            <View style={[styles.aviso, { borderColor: colors.warning }]}>
              <MapPinOff size={18} color={colors.warning} />
              <Text variant="small" style={styles.flex}>
                GPS parado. O km do dia vai sair pelo odômetro.
              </Text>
              <Button
                title="Ligar GPS"
                size="sm"
                variant="outline"
                onPress={ligarGps}
              />
            </View>
          ) : (
            <Text variant="tiny" tone="muted">
              Pode trocar de app. Só não feche o CORRE.
            </Text>
          )}
          <Button
            title="Registrar abastecimento"
            size="lg"
            icon={<Fuel size={18} color={colors.primaryForeground} />}
            onPress={() =>
              navigation.navigate('Abastecimento', { jornadaId: aberta.id })
            }
          />
          <Button
            title="Encerrar jornada"
            variant="outline"
            icon={<Square size={16} color={colors.foreground} />}
            onPress={() =>
              navigation.navigate('EncerrarJornada', { jornadaId: aberta.id })
            }
          />
        </Card>
      ) : (
        <Card glowing style={styles.cartao}>
          <Text variant="h1">Iniciar jornada</Text>
          <Text variant="body" tone="muted">
            Marca os apps, tira a foto do painel e o CORRE conta os km, mesmo
            quando você troca de app.
          </Text>
          <Button
            title="Iniciar jornada"
            size="lg"
            icon={<Bike size={18} color={colors.primaryForeground} />}
            onPress={() => navigation.navigate('IniciarJornada')}
          />
        </Card>
      )}

      {hoje.dados && hoje.dados.jornadas > 0 ? (
        <View style={styles.secao}>
          <SectionTitle>Hoje</SectionTitle>
          <ResumoDia resumo={hoje.dados} nomeDoApp={nomeDoApp} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: { gap: 12 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  flex: { flex: 1 },
  secao: { gap: 12 },
});
