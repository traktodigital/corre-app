import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import BadgePercent from 'lucide-react-native/icons/badge-percent';
import CalendarClock from 'lucide-react-native/icons/calendar-clock';
import IdCard from 'lucide-react-native/icons/id-card';
import LogIn from 'lucide-react-native/icons/log-in';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineError,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { formatDate } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { useSession } from '../../../auth';
import { createRedemption, fetchOffer } from '../../data/clubRepository';
import { discountSummary, REDEMPTION_VALIDITY_MINUTES } from '../../domain';

type RedeemError = { reason: string; requiresMembership?: boolean };

export function OfferScreen({ route, navigation }: ScreenProps<'Offer'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { user, leaveGuestMode } = useSession();
  const offer = useQuery(`offer:${id}`, () => fetchOffer(id));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<RedeemError | null>(null);

  async function redeem() {
    if (!user) {
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const result = await createRedemption(id, user.id);
      if (result.ok) {
        navigation.navigate('Redemption', { id: result.redemptionId });
      } else {
        setError({
          reason: result.reason,
          requiresMembership: result.requiresMembership,
        });
      }
    } catch {
      setError({ reason: 'A internet oscilou. Tenta de novo em instantes.' });
    } finally {
      setGenerating(false);
    }
  }

  if (offer.loading) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }
  if (offer.error && offer.data === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => offer.reload()} />
      </Screen>
    );
  }
  const o = offer.data;
  if (!o) {
    return (
      <Screen>
        <EmptyState
          icon={BadgePercent}
          title="Oferta encerrada"
          description="Essa oferta saiu do ar. Tem outras esperando por você."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const discount = discountSummary(o);
  const validUntil = formatDate(o.validUntil);
  const partnerId = o.partner?.id;

  return (
    <Screen>
      <View style={styles.gap}>
        {o.membersOnly ? (
          <Badge status="associado" label="Exclusivo associado" />
        ) : null}
        <Text variant="h1">{o.title}</Text>
        {o.partner && partnerId ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => navigation.navigate('Partner', { id: partnerId })}
          >
            <Text variant="small" tone="highlight" style={styles.bold}>
              {o.partner.name}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {discount ? (
        <Card padding={20} glowing>
          <Text variant="caption" tone="muted">
            Seu benefício
          </Text>
          <Text variant="hero" tone="highlight">
            {discount}
          </Text>
        </Card>
      ) : null}

      {o.description ? <Text variant="small">{o.description}</Text> : null}

      <Card style={styles.gap}>
        {validUntil ? (
          <View style={styles.info}>
            <CalendarClock size={16} color={colors.highlight} />
            <Text variant="small">Vale até {validUntil}</Text>
          </View>
        ) : null}
        <Text variant="small" tone="muted">
          O código gerado vale por {REDEMPTION_VALIDITY_MINUTES} minutos. Gere
          só quando estiver no balcão.
        </Text>
        {o.rules ? (
          <Text variant="small" tone="muted">
            {o.rules}
          </Text>
        ) : null}
      </Card>

      {error ? (
        <View style={styles.gap}>
          <InlineError text={error.reason} />
          {error.requiresMembership ? (
            <Button
              variant="outline"
              title="Quero me filiar à ASSEMAG"
              icon={<IdCard size={16} color={colors.foreground} />}
              onPress={() => navigation.navigate('MembershipRequest')}
            />
          ) : null}
        </View>
      ) : null}

      {user ? (
        <Button
          size="lg"
          title={generating ? 'Gerando código...' : 'Resgatar agora'}
          loading={generating}
          onPress={redeem}
        />
      ) : (
        <Button
          size="lg"
          title="Entrar pra resgatar"
          icon={<LogIn size={16} color={colors.primaryForeground} />}
          onPress={leaveGuestMode}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700' },
});
