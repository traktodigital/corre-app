import { Linking, StyleSheet, View } from 'react-native';
import { Clock, MapPin, MessageCircle, Store } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../components/ui';
import { soDigitos } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { buscarParceiro, listarOfertasDoParceiro } from './api';
import { CardOferta, LogoParceiro } from './components';

export function ParceiroScreen({ route, navigation }: ScreenProps<'Parceiro'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const parceiro = useConsulta(`parceiro:${id}`, () => buscarParceiro(id));
  const ofertas = useConsulta(`ofertas-parceiro:${id}`, () =>
    listarOfertasDoParceiro(id),
  );

  if (parceiro.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (parceiro.erro && parceiro.dados === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => parceiro.recarregar()} />
      </Screen>
    );
  }
  const p = parceiro.dados;
  if (!p) {
    return (
      <Screen>
        <EmptyState
          icon={Store}
          title="Parceiro fora do ar"
          description="Esse parceiro não está mais no clube. Dá uma olhada nos outros."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const endereco = [p.endereco, p.bairro, p.cidade, p.uf]
    .filter(Boolean)
    .join(', ');
  const whatsapp = soDigitos(p.whatsapp ?? '');

  return (
    <Screen
      onRefresh={() =>
        Promise.all([parceiro.recarregar(true), ofertas.recarregar(true)])
      }
    >
      <Card padding={20} style={styles.header}>
        <LogoParceiro url={p.logo_url} size={64} />
        <View style={styles.flex}>
          <Text variant="h2">{p.nome_fantasia}</Text>
          {p.categoria ? (
            <Text variant="caption" tone="highlight">
              {p.categoria.nome}
            </Text>
          ) : null}
        </View>
      </Card>

      {p.descricao ? (
        <Text variant="small" tone="muted">
          {p.descricao}
        </Text>
      ) : null}

      {endereco || p.horario_funcionamento ? (
        <Card style={styles.infos}>
          {endereco ? (
            <View style={styles.info}>
              <MapPin size={16} color={colors.highlight} />
              <Text variant="small" style={styles.flex}>
                {endereco}
              </Text>
            </View>
          ) : null}
          {p.horario_funcionamento ? (
            <View style={styles.info}>
              <Clock size={16} color={colors.highlight} />
              <Text variant="small" style={styles.flex}>
                {p.horario_funcionamento}
              </Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {whatsapp ? (
        <Button
          variant="outline"
          title="Chamar no WhatsApp"
          icon={<MessageCircle size={16} color={colors.foreground} />}
          onPress={() =>
            Linking.openURL(
              `https://wa.me/${
                whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp
              }`,
            )
          }
        />
      ) : null}

      <View>
        <SectionTitle hint="toque pra resgatar">Ofertas</SectionTitle>
        {ofertas.carregando ? (
          <ListSkeleton rows={2} />
        ) : ofertas.erro && !ofertas.dados ? (
          <ErrorState onRetry={() => ofertas.recarregar()} />
        ) : (ofertas.dados ?? []).length === 0 ? (
          <EmptyState
            icon={Store}
            title="Sem oferta no ar"
            description="Esse parceiro ainda não publicou desconto. Volta depois."
          />
        ) : (
          <View style={styles.list}>
            {ofertas.dados!.map(o => (
              <CardOferta
                key={o.id}
                oferta={o}
                nomeParceiro={p.nome_fantasia}
                onPress={() => navigation.navigate('Oferta', { id: o.id })}
              />
            ))}
          </View>
        )}
      </View>

      {/* TODO(fase-2): avaliações do parceiro (nota_media / total_avaliacoes). */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  infos: { gap: 12 },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  list: { gap: 12 },
});
