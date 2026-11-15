import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import { Button, ErrorState, ListSkeleton, Text } from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { fetchTripSummary, listDeliveryApps } from '../../data/tripRepository';
import { formatKm } from '../../domain';
import { DaySummary } from '../components/DaySummary';
import { tripQueryKeys } from '../queryKeys';

export function TripSummaryScreen({
  navigation,
  route,
}: ScreenProps<'TripSummary'>) {
  const { jornadaId: tripId } = route.params;
  const summary = useQuery(tripQueryKeys.tripSummary(tripId), () =>
    fetchTripSummary(tripId),
  );
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const appName = (id: string) => apps.data?.find(a => a.id === id)?.name ?? id;

  if (summary.data === undefined) {
    return (
      <Screen>
        {summary.error ? (
          <ErrorState onRetry={() => summary.reload()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const result = summary.data;
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">{formatKm(result.km)} rodados</Text>
        <Text variant="body" tone="muted">
          {result.profit >= 0
            ? 'Esse é o que sobrou depois do combustível.'
            : 'O combustível passou do que entrou hoje.'}
        </Text>
      </View>
      <DaySummary summary={result} appName={appName} />
      <Button
        title="Voltar pras entregas"
        size="lg"
        fullWidth
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
});
