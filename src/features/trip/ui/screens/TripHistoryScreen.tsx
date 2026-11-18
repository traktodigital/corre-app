import { Bike, ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text as RNText,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { formatCurrency } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { Screen } from '../../../../shared/layout';
import { palette, useTheme } from '../../../../shared/theme';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBox,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import { useSession } from '../../../auth';
import { listDeliveryApps } from '../../data/tripRepository';
import { groupByMonth, type TripListItem } from '../../domain';
import { tripQueryKeys } from '../queryKeys';
import { useTripHistory, type HistoryStatus } from '../useTripHistory';

function rowTitle(startedAt: string): string {
  const weekday = new Date(startedAt).toLocaleDateString('pt-BR', {
    weekday: 'long',
  });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function rowDate(startedAt: string): string {
  const date = new Date(startedAt);
  const day = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

export function TripHistoryScreen({ navigation }: ScreenProps<'TripHistory'>) {
  const { colors, layout } = useTheme();
  const { user } = useSession();
  const history = useTripHistory(user?.id ?? null);
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const appName = (id: string) => apps.data?.find(a => a.id === id)?.name ?? id;

  if (history.trips.length === 0) {
    return (
      <Screen>
        {history.status === 'error' ? (
          <ErrorState onRetry={history.retry} />
        ) : history.status === 'end' ? (
          <EmptyState
            icon={Bike}
            title="Nenhuma jornada ainda"
            description="Quando você encerrar uma jornada, ela aparece aqui com o trajeto e o que sobrou."
          />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const sections = groupByMonth(history.trips).map(group => ({
    title: group.month,
    data: group.items,
  }));

  return (
    <SectionList
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: layout.screenPadding, maxWidth: layout.maxWidth },
      ]}
      sections={sections}
      keyExtractor={trip => trip.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text variant="h2" style={styles.header}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }) => (
        <TripRow
          trip={item}
          apps={item.appIds.map(appName).join(', ')}
          onPress={() =>
            navigation.navigate('TripSummary', { tripId: item.id })
          }
        />
      )}
      ItemSeparatorComponent={Separator}
      onEndReached={history.loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={history.refreshing}
          onRefresh={history.refresh}
          tintColor={colors.highlight}
          colors={[colors.primary]}
        />
      }
      ListFooterComponent={
        <Footer status={history.status} onRetry={history.retry} />
      }
    />
  );
}

const TripRow = memo(function TripRowCard({
  trip,
  apps,
  onPress,
}: {
  trip: TripListItem;
  apps: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card padding={16} style={styles.row}>
        <IconBox size={48}>
          <Bike size={22} color={colors.highlight} />
        </IconBox>
        <View style={styles.info}>
          <Text variant="title">{rowTitle(trip.startedAt)}</Text>
          <Text
            style={[styles.km, { color: colors.highlight }]}
            numberOfLines={1}
          >
            {trip.km.toFixed(1).replace('.', ',')}
            <RNText style={styles.unit}>KM</RNText>
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[rowDate(trip.startedAt), apps].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.right}>
          <Text variant="small" style={[styles.money, styles.mint]}>
            {formatCurrency(trip.earnings)}
          </Text>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </View>
      </Card>
    </Pressable>
  );
});

function Separator() {
  return <View style={styles.separator} />;
}

function Footer({
  status,
  onRetry,
}: {
  status: HistoryStatus;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.footer}>
      {status === 'loading' ? (
        <ActivityIndicator color={colors.highlight} />
      ) : status === 'error' ? (
        <Button title="Tentar de novo" variant="ghost" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingTop: 8,
    paddingBottom: 104,
  },
  header: { paddingTop: 20, paddingBottom: 10 },
  separator: { height: 10 },
  footer: { minHeight: 64, justifyContent: 'center', paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  info: { flex: 1, gap: 2 },
  km: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 15 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  money: { fontWeight: '700' },
  mint: { color: palette.mint },
});
