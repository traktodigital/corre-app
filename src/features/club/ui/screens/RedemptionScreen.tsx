import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CheckCircle2, Clock, Info, WifiOff } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  InlineError,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { formatCurrency } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { palette, useTheme } from '../../../../shared/theme';
import { fetchRedemption } from '../../data/clubRepository';
import {
  pollIntervalMs,
  REDEMPTION_VALIDITY_MINUTES,
  redemptionDeadline,
} from '../../domain';

function useSecondsLeft(generatedAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!generatedAt) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [generatedAt]);
  if (!generatedAt) {
    return null;
  }
  return Math.max(
    0,
    Math.round((redemptionDeadline(generatedAt) - now) / 1000),
  );
}

export function RedemptionScreen({
  route,
  navigation,
}: ScreenProps<'Redemption'>) {
  const { id } = route.params;
  const { colors, radius } = useTheme();

  const [finished, setFinished] = useState(false);
  const [pollMs, setPollMs] = useState(pollIntervalMs(undefined));
  const redemption = useQuery(`redemption:${id}`, () => fetchRedemption(id), {
    intervalMs: finished ? undefined : pollMs,
  });
  const r = redemption.data;
  const secondsLeft = useSecondsLeft(r?.generatedAt);
  useEffect(() => {
    setPollMs(pollIntervalMs(r?.generatedAt));
  }, [r?.generatedAt, secondsLeft]);
  useEffect(() => {
    if (r && (r.status !== 'generated' || secondsLeft === 0)) {
      setFinished(true);
    }
  }, [r, secondsLeft]);

  if (redemption.loading) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }

  if (!r) {
    return (
      <Screen onRefresh={() => redemption.reload(true)}>
        {redemption.error ? (
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

  if (r.status === 'validated') {
    return (
      <Screen>
        <View style={styles.success}>
          <CheckCircle2 size={72} color={colors.highlight} />
          <Text variant="h1" style={styles.center}>
            Desconto liberado!
          </Text>
          <Text variant="small" tone="muted" style={styles.center}>
            {r.partner?.name} validou o seu código {r.code}.
          </Text>
          {r.savedAmount ? (
            <Text variant="hero" tone="highlight">
              + {formatCurrency(r.savedAmount)}
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

  const closed = r.status === 'expired' || r.status === 'cancelled';
  const remaining = secondsLeft ?? 0;
  const expired = closed || remaining === 0;
  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <Screen onRefresh={() => redemption.reload(true)}>
      <View>
        <Text variant="h2" style={styles.center}>
          {r.offer?.title}
        </Text>
        <Text variant="small" tone="muted" style={styles.center}>
          {r.partner?.name}
        </Text>
      </View>

      <View
        style={[
          styles.qrBox,
          { borderRadius: radius['2xl'], backgroundColor: palette.white },
        ]}
      >
        {expired ? (
          <Text variant="h3" style={[styles.expired, styles.dark]}>
            Código vencido
          </Text>
        ) : (
          <QRCode value={r.qrToken} size={200} />
        )}
        <Text variant="micro" style={styles.codeLabel}>
          CÓDIGO DO RESGATE
        </Text>
        <Text variant="hero" style={[styles.code, styles.dark]}>
          {r.code}
        </Text>
      </View>

      <View style={styles.line}>
        <Clock size={16} color={colors.highlight} />
        {expired ? (
          <Text variant="small" tone="danger">
            Passou dos {REDEMPTION_VALIDITY_MINUTES} minutos — gere outro na
            oferta.
          </Text>
        ) : (
          <Text variant="small" tone="muted">
            Vale por mais{' '}
            <Text variant="small" style={styles.bold}>
              {minutes}:{seconds}
            </Text>
          </Text>
        )}
      </View>

      {redemption.error ? (
        <InlineError text="A internet oscilou. O código acima continua valendo no balcão." />
      ) : null}

      <Card style={styles.line}>
        <WifiOff size={16} color={colors.mutedForeground} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          Sem sinal no balcão? Fale o código {r.code} — o parceiro digita no
          painel dele e funciona igual.
        </Text>
      </Card>

      <Card style={styles.steps}>
        <Text variant="title">Como usar</Text>
        <Text variant="small" tone="muted">
          1. Avise no caixa que você é do Sou Corre antes de pagar.
        </Text>
        <Text variant="small" tone="muted">
          2. Mostre o QR ou fale o código {r.code}.
        </Text>
        <Text variant="small" tone="muted">
          3. O parceiro valida e o desconto entra na conta.
        </Text>
        {r.offer?.rules ? (
          <Text variant="small" tone="muted">
            4. {r.offer.rules}
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
  dark: { color: palette.black },
  success: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  qrBox: { alignItems: 'center', padding: 24 },
  expired: { paddingVertical: 80 },
  codeLabel: { marginTop: 20, color: '#6b7280', letterSpacing: 1 },
  code: { letterSpacing: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  steps: { gap: 6 },
});
