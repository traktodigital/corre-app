import { Pressable, StyleSheet, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { formatCurrency, formatDateTime } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useSession } from '../../../auth';
import { listUserRedemptions } from '../../data/clubRepository';
import { displayedStatus } from '../../domain';
import { RedemptionBadge } from '../components/RedemptionBadge';

export function RedemptionHistoryScreen({
  navigation,
}: ScreenProps<'RedemptionHistory'>) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const redemptions = useQuery(userId ? `redemptions:${userId}` : null, () =>
    listUserRedemptions(userId!),
  );

  if (redemptions.loading) {
    return (
      <Screen>
        <ListSkeleton rows={4} />
      </Screen>
    );
  }
  if (redemptions.error && !redemptions.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => redemptions.reload()} />
      </Screen>
    );
  }

  const list = redemptions.data ?? [];

  return (
    <Screen onRefresh={() => redemptions.reload(true)}>
      {list.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum resgate ainda"
          description="Quando você usar um benefício no balcão, ele aparece aqui."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      ) : (
        <View style={styles.list}>
          {list.map(r => {
            const status = displayedStatus(r);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                disabled={status !== 'generated'}
                onPress={() => navigation.navigate('Redemption', { id: r.id })}
              >
                <Card style={styles.item}>
                  <View style={styles.top}>
                    <Text variant="title" style={styles.flex} numberOfLines={1}>
                      {r.offer?.title ?? 'Oferta'}
                    </Text>
                    <RedemptionBadge status={status} />
                  </View>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {r.partner?.name} · {r.code}
                  </Text>
                  <View style={styles.top}>
                    <Text variant="caption" tone="muted">
                      {formatDateTime(r.validatedAt ?? r.generatedAt)}
                    </Text>
                    {status === 'validated' && r.savedAmount ? (
                      <Text
                        variant="caption"
                        tone="highlight"
                        style={styles.bold}
                      >
                        + {formatCurrency(r.savedAmount)}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  item: { gap: 4 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
});
