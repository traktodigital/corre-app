import { Bike, ChevronLeft, Fuel, Package } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import {
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ScreenProps } from '../../../../app/navigation';
import { formatCurrency } from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { alpha, palette, useTheme } from '../../../../shared/theme';
import {
  Button,
  Card,
  ErrorState,
  ListSkeleton,
  Text,
} from '../../../../shared/ui';
import {
  downloadRoute,
  fetchTripPeriod,
  fetchTripSummary,
  listDeliveryApps,
  readRouteFile,
} from '../../data/tripRepository';
import { formatClock, type TripPeriod } from '../../domain';
import { RouteMap } from '../components/RouteMap';
import { tripQueryKeys } from '../queryKeys';

const HERO_HEIGHT = 520;
const HERO_TEXT_SPACE = 250;

type Amount = { prefix?: string; value: string; unit?: string };

function money(value: number | null): Amount {
  if (value === null) {
    return { value: '—' };
  }
  return {
    prefix: value < 0 ? '-R$' : 'R$',
    value: formatCurrency(Math.abs(value)).replace(/^R\$\s*/, ''),
  };
}

function km(value: number): Amount {
  return { value: value.toFixed(1).replace('.', ','), unit: 'KM' };
}

function heroTitle(period: TripPeriod | undefined): string {
  if (!period) {
    return 'Sua jornada';
  }
  const weekday = new Date(period.startedAt).toLocaleDateString('pt-BR', {
    weekday: 'long',
  });
  return `Jornada de ${weekday}`;
}

function periodLabel(period: TripPeriod | undefined): string | null {
  if (!period?.endedAt) {
    return null;
  }
  const start = new Date(period.startedAt);
  const time = (date: Date) =>
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = start.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${day} · ${time(start)}–${time(new Date(period.endedAt))}`;
}

export function TripSummaryScreen({
  navigation,
  route,
}: ScreenProps<'TripSummary'>) {
  const { tripId, routeFile } = route.params;
  const { colors, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const summary = useQuery(tripQueryKeys.tripSummary(tripId), () =>
    fetchTripSummary(tripId),
  );
  const period = useQuery(tripQueryKeys.tripPeriod(tripId), () =>
    fetchTripPeriod(tripId),
  );
  const routePath = period.data?.routePath ?? null;
  const routeSource = routeFile ?? routePath;
  const routePoints = useQuery(
    routeSource ? tripQueryKeys.route(routeSource) : null,
    () =>
      routeFile ? readRouteFile(routeFile) : downloadRoute(routePath ?? ''),
  );
  const apps = useQuery(tripQueryKeys.deliveryApps, listDeliveryApps);
  const [pastHero, setPastHero] = useState(false);
  const appName = (id: string) => apps.data?.find(a => a.id === id)?.name ?? id;

  const result = summary.data;
  const usedApps = result?.byApp.filter(a => a.amount !== null) ?? [];
  const rides = usedApps.reduce((sum, a) => sum + (a.rides ?? 0), 0);
  const when = periodLabel(period.data);
  const hours = period.data?.endedAt
    ? (Date.parse(period.data.endedAt) - Date.parse(period.data.startedAt)) /
      3_600_000
    : result?.hours ?? 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEventThrottle={64}
        onScroll={e =>
          setPastHero(e.nativeEvent.contentOffset.y > HERO_HEIGHT - 200)
        }
      >
        <View style={{ height: HERO_HEIGHT }}>
          <RouteMap
            points={routePoints.data ?? []}
            width={width}
            height={HERO_HEIGHT}
            routeTop={insets.top + 56}
            routeBottom={HERO_HEIGHT - HERO_TEXT_SPACE}
          />
          {result ? (
            <View style={styles.heroText}>
              <View style={styles.inline}>
                <Bike size={15} color={colors.foreground} />
                <Text variant="small" style={styles.bold}>
                  {usedApps.length
                    ? usedApps.map(a => appName(a.appId)).join(' · ')
                    : 'Entregas'}
                </Text>
              </View>
              <Text variant="hero">{heroTitle(period.data)}</Text>
              <BigNumber
                amount={km(result.km)}
                color={colors.highlight}
                size={44}
              />
              {when ? (
                <Text variant="small" tone="muted">
                  {when}
                </Text>
              ) : null}
              <View style={styles.quickStats}>
                {rides > 0 ? (
                  <QuickStat
                    icon={<Package size={16} color={colors.foreground} />}
                    value={String(rides)}
                    label="Corridas"
                  />
                ) : null}
                {result.liters > 0 ? (
                  <QuickStat
                    icon={<Fuel size={16} color={colors.foreground} />}
                    value={`${result.liters.toFixed(1).replace('.', ',')} L`}
                    label="Abasteceu"
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.body,
            {
              maxWidth: layout.maxWidth,
              paddingHorizontal: layout.screenPadding,
            },
          ]}
        >
          {result === undefined ? (
            summary.error ? (
              <ErrorState onRetry={() => summary.reload()} />
            ) : (
              <ListSkeleton />
            )
          ) : (
            <>
              <Text variant="h2">Detalhes da jornada</Text>
              <Card padding={20} style={styles.card}>
                <View style={styles.row}>
                  <Metric
                    label="Tempo de jornada"
                    amount={{ value: formatClock(hours) }}
                    color={colors.warning}
                  />
                  <Metric
                    label="Rodou"
                    amount={km(result.km)}
                    color={colors.highlight}
                  />
                </View>
                <View style={styles.row}>
                  <Metric
                    label="Fez"
                    amount={money(result.totalEarnings)}
                    color={palette.mint}
                  />
                  <Metric
                    label="Gastou"
                    amount={money(result.fuelCost)}
                    color={colors.destructive}
                  />
                </View>
                <Metric
                  label="Sobrou"
                  amount={money(result.profit)}
                  color={
                    result.profit >= 0 ? colors.success : colors.destructive
                  }
                  size={40}
                />
              </Card>

              <Text variant="h2">Quanto rendeu</Text>
              <Card padding={20} style={styles.card}>
                <View style={styles.row}>
                  <Metric
                    label="Custo por km"
                    amount={money(result.costPerKm)}
                    color={colors.destructive}
                    size={24}
                  />
                  <Metric
                    label="Ganho por km"
                    amount={money(result.earningsPerKm)}
                    color={colors.success}
                    size={24}
                  />
                </View>
                <Metric
                  label="Ganho por hora"
                  amount={money(result.earningsPerHour)}
                  color={colors.warning}
                  size={24}
                />
                {usedApps.length > 1 ? (
                  <Text variant="tiny" tone="muted">
                    Rodou em mais de um app: o ganho por km é a média do dia
                    inteiro.
                  </Text>
                ) : null}
              </Card>

              {usedApps.length > 0 ? (
                <>
                  <Text variant="h2">Por app</Text>
                  <Card padding={20} style={styles.card}>
                    {usedApps.map(a => (
                      <View key={a.appId} style={styles.appLine}>
                        <View style={styles.flex}>
                          <Text variant="body" style={styles.bold}>
                            {appName(a.appId)}
                          </Text>
                          {a.perRide !== null ? (
                            <Text variant="small" tone="muted">
                              {`${formatCurrency(a.perRide)} por corrida`}
                            </Text>
                          ) : null}
                        </View>
                        <BigNumber
                          amount={money(a.amount)}
                          color={colors.foreground}
                          size={22}
                        />
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}

              <Button
                title={routeFile ? 'Voltar pras entregas' : 'Voltar'}
                size="lg"
                fullWidth
                onPress={() => navigation.goBack()}
              />
            </>
          )}
        </View>
      </ScrollView>

      {pastHero ? (
        <View
          style={[
            styles.topBar,
            {
              height: insets.top + 60,
              backgroundColor: alpha(colors.background, 0.94),
              borderColor: colors.border,
            },
          ]}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
        onPress={() => navigation.goBack()}
        style={[
          styles.back,
          {
            top: insets.top + 8,
            backgroundColor: alpha(colors.card, 0.75),
            borderColor: colors.border,
          },
        ]}
      >
        <ChevronLeft size={24} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

function BigNumber({
  amount,
  color,
  size,
}: {
  amount: Amount;
  color: string;
  size: number;
}) {
  const unit = { fontSize: Math.round(size * 0.55) };
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.number,
        { color, fontSize: size, lineHeight: Math.round(size * 1.15) },
      ]}
    >
      {amount.prefix ? (
        <RNText style={unit}>{`${amount.prefix} `}</RNText>
      ) : null}
      {amount.value}
      {amount.unit ? <RNText style={unit}>{amount.unit}</RNText> : null}
    </Text>
  );
}

function Metric({
  label,
  amount,
  color,
  size = 30,
}: {
  label: string;
  amount: Amount;
  color: string;
  size?: number;
}) {
  return (
    <View style={styles.metric}>
      <Text variant="small">{label}</Text>
      <BigNumber amount={amount} color={color} size={size} />
    </View>
  );
}

function QuickStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View>
      <View style={styles.inline}>
        {icon}
        <Text variant="body" style={styles.bold}>
          {value}
        </Text>
      </View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 104 },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 4, gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bold: { fontWeight: '700' },
  quickStats: { flexDirection: 'row', gap: 28, marginTop: 14 },
  body: { width: '100%', alignSelf: 'center', gap: 14, marginTop: 12 },
  card: { gap: 18 },
  row: { flexDirection: 'row', gap: 16 },
  metric: { flex: 1, gap: 2 },
  number: {
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  appLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
