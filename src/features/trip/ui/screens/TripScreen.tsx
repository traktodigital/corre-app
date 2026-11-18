import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bike, Fuel, MapPinOff, Route, Square } from 'lucide-react-native';
import type { RootNav } from '../../../../app/navigation';
import { openSettings } from '../../../../core/permissions';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { useSession } from '../../../auth';
import {
  fetchOpenTrip,
  fetchTodaySummary,
  listDeliveryApps,
} from '../../data/tripRepository';
import { formatDuration, formatKm } from '../../domain';
import { DaySummary } from '../components/DaySummary';
import { tripQueryKeys } from '../queryKeys';
import { useTripTracking, type TrackingIssue } from '../useTripTracking';

const CLOCK_TICK_MS = 30_000;

type TrackingWarning = {
  text: string;
  action: 'turnOn' | 'settings' | null;
};

function trackingWarning(issue: TrackingIssue | null): TrackingWarning {
  switch (issue) {
    case 'blocked':
      return {
        text: 'Localização bloqueada. O km do dia vai sair pelo odômetro.',
        action: 'settings',
      };
    case 'unavailable':
      return {
        text: 'GPS indisponível neste aparelho. O km do dia vai sair pelo odômetro.',
        action: null,
      };
    default:
      return {
        text: 'GPS parado. O km do dia vai sair pelo odômetro.',
        action: 'turnOn',
      };
  }
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function TripScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const { user, leaveGuestMode } = useSession();
  const userId = user?.id ?? null;

  const openTripQuery = useQuery(
    userId ? tripQueryKeys.openTrip(userId) : null,
    fetchOpenTrip,
  );
  const today = useQuery(
    userId ? tripQueryKeys.todaySummary(userId) : null,
    fetchTodaySummary,
  );
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const trip = openTripQuery.data ?? null;
  const tracking = useTripTracking(trip?.id ?? null);
  const now = useNow(CLOCK_TICK_MS);

  const appName = (id: string) => apps.data?.find(a => a.id === id)?.name ?? id;

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={Bike}
          title="Sua jornada do dia"
          description="Entra na sua conta pra contar os km, o abastecimento e quanto cada app pagou."
          action={<Button title="Entrar" onPress={leaveGuestMode} />}
        />
      </Screen>
    );
  }

  if (openTripQuery.data === undefined && openTripQuery.loading) {
    return (
      <Screen>
        <ListSkeleton />
      </Screen>
    );
  }

  if (openTripQuery.error && openTripQuery.data === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => openTripQuery.reload()} />
      </Screen>
    );
  }

  const warning = trackingWarning(tracking.issue);

  return (
    <Screen
      onRefresh={() =>
        Promise.all([
          openTripQuery.reload(true),
          today.reload(true),
          tracking.reload(true),
        ])
      }
    >
      {trip ? (
        <Card glowing style={styles.card}>
          <Text variant="caption" tone="highlight">
            Jornada em andamento
          </Text>
          <Text variant="hero">{formatKm(tracking.state?.km ?? 0)}</Text>
          <Text variant="small" tone="muted">
            {`${formatDuration(
              now - new Date(trip.startedAt).getTime(),
            )} rodando · ${trip.appIds.map(appName).join(', ')}`}
          </Text>
          {tracking.stopped ? (
            <View style={[styles.warning, { borderColor: colors.warning }]}>
              <MapPinOff size={18} color={colors.warning} />
              <Text variant="small" style={styles.flex}>
                {warning.text}
              </Text>
              {warning.action === 'turnOn' ? (
                <Button
                  title="Ligar GPS"
                  size="sm"
                  variant="outline"
                  onPress={tracking.turnOn}
                />
              ) : null}
              {warning.action === 'settings' ? (
                <Button
                  title="Abrir ajustes"
                  size="sm"
                  variant="outline"
                  onPress={openSettings}
                />
              ) : null}
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
            onPress={() => navigation.navigate('Refuel', { tripId: trip.id })}
          />
          <Button
            title="Encerrar jornada"
            variant="outline"
            icon={<Square size={16} color={colors.foreground} />}
            onPress={() => navigation.navigate('EndTrip', { tripId: trip.id })}
          />
        </Card>
      ) : (
        <Card glowing style={styles.card}>
          <Text variant="h1">Iniciar jornada</Text>
          <Text variant="body" tone="muted">
            Marca os apps, tira a foto do painel e o CORRE conta os km, mesmo
            quando você troca de app.
          </Text>
          <Button
            title="Iniciar jornada"
            size="lg"
            icon={<Bike size={18} color={colors.primaryForeground} />}
            onPress={() => navigation.navigate('StartTrip')}
          />
        </Card>
      )}

      {today.data && today.data.trips > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Hoje</SectionTitle>
          <DaySummary summary={today.data} appName={appName} />
        </View>
      ) : null}

      <Button
        title="Ver todas as jornadas"
        variant="outline"
        size="lg"
        fullWidth
        icon={<Route size={18} color={colors.foreground} />}
        onPress={() => navigation.navigate('TripHistory')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  flex: { flex: 1 },
  section: { gap: 12 },
});
