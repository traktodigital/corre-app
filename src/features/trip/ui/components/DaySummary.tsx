import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../../../shared/ui';
import { formatCurrency } from '../../../../shared/format';
import { formatKm, type TripSummary } from '../../domain';

const PROFIT_LABEL = 'Sobrou';

export function DaySummary({
  summary,
  appName,
}: {
  summary: TripSummary;
  appName: (id: string) => string;
}) {
  const profit = summary.profit;
  const tiles = [
    { label: 'Rodou', value: formatKm(summary.km) },
    { label: 'Gastou', value: formatCurrency(summary.fuelCost) },
    { label: 'Fez', value: formatCurrency(summary.totalEarnings) },
    { label: PROFIT_LABEL, value: formatCurrency(profit) },
  ];
  const appsWithAmount = summary.byApp.filter(a => a.amount !== null);
  return (
    <View style={styles.summary}>
      <View style={styles.grid}>
        {tiles.map(tile => (
          <Card key={tile.label} style={styles.tile} padding={14}>
            <Text variant="caption" tone="muted">
              {tile.label}
            </Text>
            <Text
              variant="h2"
              tone={
                tile.label === PROFIT_LABEL
                  ? profit >= 0
                    ? 'success'
                    : 'danger'
                  : 'default'
              }
            >
              {tile.value}
            </Text>
          </Card>
        ))}
      </View>
      <Card padding={14} style={styles.details}>
        <SummaryLine label="Custo por km" value={summary.costPerKm} />
        <SummaryLine label="Ganho por km" value={summary.earningsPerKm} />
        <SummaryLine label="Ganho por hora" value={summary.earningsPerHour} />
        {appsWithAmount.length > 1 ? (
          <Text variant="tiny" tone="muted">
            Rodou em mais de um app: o ganho por km é a média do dia inteiro.
          </Text>
        ) : null}
      </Card>
      {appsWithAmount.length > 0 ? (
        <Card padding={14} style={styles.details}>
          {appsWithAmount.map(a => (
            <View key={a.appId} style={styles.line}>
              <Text variant="body">{appName(a.appId)}</Text>
              <Text variant="body">
                {formatCurrency(a.amount ?? 0)}
                {a.perRide !== null ? (
                  <Text variant="small" tone="muted">
                    {`  ·  ${formatCurrency(a.perRide)}/corrida`}
                  </Text>
                ) : null}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <View style={styles.line}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="small">
        {value === null ? '—' : formatCurrency(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  details: { gap: 8 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
