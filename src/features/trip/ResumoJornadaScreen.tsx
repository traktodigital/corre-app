import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../shared/layout';
import { Button, ErrorState, ListSkeleton, Text } from '../../shared/ui';
import { useConsulta } from '../../shared/hooks/useQuery';
import { listarApps, resumoJornada } from './api';
import { ResumoDia } from './componentes';
import { formatarKm } from './regras';

export function ResumoJornadaScreen({
  navigation,
  route,
}: ScreenProps<'TripSummary'>) {
  const { jornadaId } = route.params;
  const resumo = useConsulta(`resumo:${jornadaId}`, () =>
    resumoJornada(jornadaId),
  );
  const apps = useConsulta('apps-entrega', listarApps);
  const nomeDoApp = (id: string) =>
    apps.dados?.find(a => a.id === id)?.nome ?? id;

  if (resumo.dados === undefined) {
    return (
      <Screen>
        {resumo.erro ? (
          <ErrorState onRetry={() => resumo.recarregar()} />
        ) : (
          <ListSkeleton />
        )}
      </Screen>
    );
  }

  const r = resumo.dados;
  return (
    <Screen>
      <View style={styles.topo}>
        <Text variant="h1">{formatarKm(r.km)} rodados</Text>
        <Text variant="body" tone="muted">
          {r.lucro >= 0
            ? 'Esse é o que sobrou depois do combustível.'
            : 'O combustível passou do que entrou hoje.'}
        </Text>
      </View>
      <ResumoDia resumo={r} nomeDoApp={nomeDoApp} />
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
  topo: { gap: 6 },
});
