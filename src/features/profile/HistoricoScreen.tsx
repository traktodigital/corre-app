import { Pressable, StyleSheet, View } from 'react-native';
import { Receipt } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { formatarDataHora, formatarReal } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { useAuth } from '../auth/AuthProvider';
import { listarMeusResgates, statusExibido } from '../clube/api';
import { BadgeResgate } from '../clube/components';

/** Histórico de uso: cada resgate com parceiro, data/hora e status. */
export function HistoricoScreen({ navigation }: ScreenProps<'Historico'>) {
  const { user } = useAuth();
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
                onPress={() => navigation.navigate('Resgate', { id: r.id })}
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
