import { Pressable, StyleSheet, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Text,
} from '../../shared/ui';
import { formatarDataHora, formatarReal } from '../../shared/format';
import { useConsulta } from '../../shared/hooks/useQuery';
import { useSession } from '../auth';
import { listarMeusResgates, statusExibido } from './api';
import { BadgeResgate } from './components';

export function HistoricoScreen({
  navigation,
}: ScreenProps<'RedemptionHistory'>) {
  const { user } = useSession();
  const usuarioId = user?.id ?? null;
  const resgates = useConsulta(usuarioId ? `resgates:${usuarioId}` : null, () =>
    listarMeusResgates(usuarioId!),
  );

  if (resgates.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={4} />
      </Screen>
    );
  }
  if (resgates.erro && !resgates.dados) {
    return (
      <Screen>
        <ErrorState onRetry={() => resgates.recarregar()} />
      </Screen>
    );
  }

  const lista = resgates.dados ?? [];

  return (
    <Screen onRefresh={() => resgates.recarregar(true)}>
      {lista.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum resgate ainda"
          description="Quando você usar um benefício no balcão, ele aparece aqui."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      ) : (
        <View style={styles.list}>
          {lista.map(r => {
            const status = statusExibido(r);
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                disabled={status !== 'gerado'}
                onPress={() => navigation.navigate('Redemption', { id: r.id })}
              >
                <Card style={styles.item}>
                  <View style={styles.topo}>
                    <Text variant="title" style={styles.flex} numberOfLines={1}>
                      {r.oferta?.titulo ?? 'Oferta'}
                    </Text>
                    <BadgeResgate status={status} />
                  </View>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {r.parceiro?.nome_fantasia} · {r.codigo}
                  </Text>
                  <View style={styles.topo}>
                    <Text variant="caption" tone="muted">
                      {formatarDataHora(r.validado_em ?? r.gerado_em)}
                    </Text>
                    {status === 'validado' && r.valor_economizado ? (
                      <Text
                        variant="caption"
                        tone="highlight"
                        style={styles.bold}
                      >
                        + {formatarReal(Number(r.valor_economizado))}
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
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
});
