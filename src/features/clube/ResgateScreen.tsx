import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CheckCircle2, Clock, Info, WifiOff } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  EmptyState,
  InlineError,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { formatarReal } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { palette, useTheme } from '../../theme';
import { buscarResgate, MINUTOS_VALIDADE } from './api';

/**
 * Segundos restantes até o resgate vencer (15 min após gerado). Calculado no
 * render a partir do relógio — nada de "0" no primeiro frame, que mostrava
 * "Código vencido" por um instante.
 */
function useContagem(geradoEm: string | undefined) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!geradoEm) {
      return;
    }
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [geradoEm]);
  if (!geradoEm) {
    return null;
  }
  const fim = new Date(geradoEm).getTime() + MINUTOS_VALIDADE * 60_000;
  return Math.max(0, Math.round((fim - agora) / 1000));
}

export function ResgateScreen({ route, navigation }: ScreenProps<'Resgate'>) {
  const { id } = route.params;
  const { colors, radius } = useTheme();
  // Polling só enquanto o código está aberto: quando o parceiro valida no
  // painel dele, a tela vira "Desconto liberado" e para de consultar.
  const [finalizado, setFinalizado] = useState(false);
  const resgate = useConsulta(`resgate:${id}`, () => buscarResgate(id), {
    intervaloMs: finalizado ? undefined : 5000,
  });
  const dados = resgate.dados;
  const restante = useContagem(dados?.gerado_em);
  useEffect(() => {
    if (dados && (dados.status !== 'gerado' || restante === 0)) {
      setFinalizado(true);
    }
  }, [dados, restante]);

  if (resgate.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }

  if (!dados) {
    return (
      <Screen onRefresh={() => resgate.recarregar(true)}>
        {resgate.erro ? (
          <InlineError text="A internet oscilou. Puxe pra baixo pra tentar de novo." />
        ) : (
          <EmptyState
            icon={Info}
            title="Resgate não encontrado"
            description="Esse resgate não existe mais. Gere outro na página da oferta."
            action={
              <Button title="Voltar" onPress={() => navigation.goBack()} />
            }
          />
        )}
      </Screen>
    );
  }

  if (dados.status === 'validado') {
    return (
      <Screen>
        <View style={styles.sucesso}>
          <CheckCircle2 size={72} color={colors.highlight} />
          <Text variant="h1" style={styles.center}>
            Desconto liberado!
          </Text>
          <Text variant="small" tone="muted" style={styles.center}>
            {dados.parceiro?.nome_fantasia} validou o seu código {dados.codigo}.
          </Text>
          {dados.valor_economizado ? (
            <Text variant="hero" tone="highlight">
              + {formatarReal(Number(dados.valor_economizado))}
            </Text>
          ) : null}
          <Button
            size="lg"
            title="Bora pra próxima"
            onPress={() => navigation.popToTop()}
          />
        </View>
      </Screen>
    );
  }

  const encerrado = dados.status === 'expirado' || dados.status === 'cancelado';
  const faltam = restante ?? 0;
  const vencido = encerrado || faltam === 0;
  const minutos = String(Math.floor(faltam / 60)).padStart(2, '0');
  const segundos = String(faltam % 60).padStart(2, '0');

  return (
    <Screen onRefresh={() => resgate.recarregar(true)}>
      <View>
        <Text variant="h2" style={styles.center}>
          {dados.oferta?.titulo}
        </Text>
        <Text variant="small" tone="muted" style={styles.center}>
          {dados.parceiro?.nome_fantasia}
        </Text>
      </View>

      <View
        style={[
          styles.qrBox,
          { borderRadius: radius['2xl'], backgroundColor: palette.white },
        ]}
      >
        {vencido ? (
          <Text variant="h3" style={[styles.vencido, styles.escuro]}>
            Código vencido
          </Text>
        ) : (
          <QRCode value={dados.qr_token} size={200} />
        )}
        <Text variant="micro" style={styles.rotuloCodigo}>
          CÓDIGO DO RESGATE
        </Text>
        <Text variant="hero" style={[styles.codigo, styles.escuro]}>
          {dados.codigo}
        </Text>
      </View>

      <View style={styles.linha}>
        <Clock size={16} color={colors.highlight} />
        {vencido ? (
          <Text variant="small" tone="danger">
            Passou dos {MINUTOS_VALIDADE} minutos — gere outro na oferta.
          </Text>
        ) : (
          <Text variant="small" tone="muted">
            Vale por mais{' '}
            <Text variant="small" style={styles.bold}>
              {minutos}:{segundos}
            </Text>
          </Text>
        )}
      </View>

      {resgate.erro ? (
        <InlineError text="A internet oscilou. O código acima continua valendo no balcão." />
      ) : null}

      <Card style={styles.linha}>
        <WifiOff size={16} color={colors.mutedForeground} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          Sem sinal no balcão? Fale o código {dados.codigo} — o parceiro digita
          no painel dele e funciona igual.
        </Text>
      </Card>

      <Card style={styles.passos}>
        <Text variant="title">Como usar</Text>
        <Text variant="small" tone="muted">
          1. Avise no caixa que você é do CORRE antes de pagar.
        </Text>
        <Text variant="small" tone="muted">
          2. Mostre o QR ou fale o código {dados.codigo}.
        </Text>
        <Text variant="small" tone="muted">
          3. O parceiro valida e o desconto entra na conta.
        </Text>
        {dados.oferta?.regras ? (
          <Text variant="small" tone="muted">
            4. {dados.oferta.regras}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  escuro: { color: palette.black },
  sucesso: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  qrBox: { alignItems: 'center', padding: 24 },
  vencido: { paddingVertical: 80 },
  rotuloCodigo: { marginTop: 20, color: '#6b7280', letterSpacing: 1 },
  codigo: { letterSpacing: 4 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passos: { gap: 6 },
});
