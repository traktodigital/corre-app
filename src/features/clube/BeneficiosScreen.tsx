import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, Store } from 'lucide-react-native';
import type { RootNav } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  SectionTitle,
  Text,
} from '../../components/ui';
import { useConsulta } from '../../lib/useConsulta';
import { alpha, palette, useTheme } from '../../theme';
import {
  listarCategorias,
  listarOfertasDestaque,
  listarParceiros,
} from './api';
import { CardOferta, CardParceiro } from './components';

const TODAS = 'todas';

/** Aba Benefícios: catálogo de parceiros ativos + ofertas em destaque. */
export function BeneficiosScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors, radius } = useTheme();
  const [categoria, setCategoria] = useState(TODAS);
  const [busca, setBusca] = useState('');

  const categorias = useConsulta('categorias', listarCategorias);
  const parceiros = useConsulta('parceiros', listarParceiros);
  const destaques = useConsulta('ofertas-destaque', listarOfertasDestaque);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (parceiros.dados ?? []).filter(
      p =>
        (categoria === TODAS || p.categoria?.id === categoria) &&
        (!termo || p.nome_fantasia.toLowerCase().includes(termo)),
    );
  }, [parceiros.dados, categoria, busca]);

  const filtrando = busca.trim() !== '' || categoria !== TODAS;

  const recarregar = () =>
    Promise.all([
      categorias.recarregar(true),
      parceiros.recarregar(true),
      destaques.recarregar(true),
    ]);

  return (
    <Screen onRefresh={recarregar}>
      <View>
        <Text variant="h1">Benefícios</Text>
        <Text variant="small" tone="muted">
          Escolha o parceiro, gere o código e mostre no balcão.
        </Text>
      </View>

      {(destaques.dados ?? []).length > 0 ? (
        <View>
          <SectionTitle hint="ofertas do clube">Em destaque</SectionTitle>
          <View style={styles.list}>
            {destaques.dados!.map(o => (
              <CardOferta
                key={o.id}
                oferta={o}
                onPress={() => navigation.navigate('Oferta', { id: o.id })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.gap}>
        <SectionTitle
          hint={parceiros.dados ? `${filtrados.length} no ar` : undefined}
        >
          Parceiros
        </SectionTitle>

        <View
          style={[
            styles.busca,
            {
              borderRadius: radius.md,
              borderColor: colors.input,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Search size={18} color={colors.mutedForeground} />
          <TextInput
            accessibilityLabel="Buscar parceiro"
            placeholder="Buscar parceiro"
            placeholderTextColor={colors.mutedForeground}
            selectionColor={colors.highlight}
            value={busca}
            onChangeText={setBusca}
            style={[styles.buscaInput, { color: colors.foreground }]}
          />
        </View>

        {(categorias.dados ?? []).length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pills}
          >
            {[{ id: TODAS, nome: 'Todas' }, ...categorias.dados!].map(c => {
              const ativa = categoria === c.id;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => setCategoria(c.id)}
                  style={[
                    styles.pill,
                    { borderRadius: radius.full },
                    ativa
                      ? {
                          borderColor: colors.highlight,
                          backgroundColor: alpha(palette.green, 0.15),
                        }
                      : {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                  ]}
                >
                  <Text
                    variant="caption"
                    tone={ativa ? 'highlight' : 'default'}
                    style={styles.bold}
                  >
                    {c.nome}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {parceiros.carregando ? (
          <ListSkeleton rows={4} />
        ) : parceiros.erro && !parceiros.dados ? (
          <ErrorState onRetry={() => parceiros.recarregar()} />
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Store}
            title={filtrando ? 'Nada por aqui' : 'Parceiros chegando'}
            description={
              filtrando
                ? 'Tenta outra categoria ou outro nome.'
                : 'Os primeiros parceiros entram no ar no lançamento. Volta já já.'
            }
          />
        ) : (
          <View style={styles.list}>
            {filtrados.map(p => (
              <CardParceiro
                key={p.id}
                parceiro={p}
                onPress={() => navigation.navigate('Parceiro', { id: p.id })}
              />
            ))}
          </View>
        )}
      </View>

      {/* TODO(fase-2): ordenar "perto de você" por distância (geolocalização). */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  gap: { gap: 12 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  buscaInput: { flex: 1, fontSize: 16, height: '100%' },
  pills: { gap: 8 },
  pill: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  bold: { fontWeight: '700' },
});
