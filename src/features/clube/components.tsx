import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, Star, Store } from 'lucide-react-native';
import { Badge, Card, IconBox, Text } from '../../components/ui';
import { useTheme } from '../../theme';
import {
  Oferta,
  ParceiroResumo,
  resumoDesconto,
  rotuloStatusResgate,
  StatusResgate,
} from './api';

export function LogoParceiro({
  url,
  size = 44,
}: {
  url: string | null | undefined;
  size?: number;
}) {
  const { colors, radius } = useTheme();
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityIgnoresInvertColors
        style={{
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: colors.muted,
        }}
      />
    );
  }
  return (
    <IconBox size={size}>
      <Store size={size / 2.2} color={colors.highlight} />
    </IconBox>
  );
}

export function CardParceiro({
  parceiro,
  onPress,
}: {
  parceiro: ParceiroResumo;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const local = [parceiro.bairro, parceiro.cidade].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Parceiro ${parceiro.nome_fantasia}`}
      onPress={onPress}
    >
      <Card style={styles.row}>
        <LogoParceiro url={parceiro.logo_url} />
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={1}>
            {parceiro.nome_fantasia}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[parceiro.categoria?.nome, local].filter(Boolean).join(' · ') ||
              'Parceiro CORRE'}
          </Text>
        </View>
        {parceiro.nota_media ? (
          <View style={styles.nota}>
            <Star size={12} color={colors.mutedForeground} />
            <Text variant="tiny" tone="muted">
              {Number(parceiro.nota_media).toFixed(1)}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
}

export function CardOferta({
  oferta,
  nomeParceiro,
  onPress,
}: {
  oferta: Oferta;
  nomeParceiro?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const desconto = resumoDesconto(oferta);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Oferta ${oferta.titulo}`}
      onPress={onPress}
    >
      <Card style={styles.row}>
        <IconBox>
          <Store size={20} color={colors.highlight} />
        </IconBox>
        <View style={styles.flex}>
          <Text variant="title" numberOfLines={2}>
            {oferta.titulo}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[desconto, nomeParceiro ?? oferta.parceiro?.nome_fantasia]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {oferta.exclusivo_associados ? (
          <Badge status="associado" label="Associado" />
        ) : null}
      </Card>
    </Pressable>
  );
}

const tomStatus: Record<StatusResgate, 'ativo' | 'a-vencer' | 'inadimplente'> =
  {
    gerado: 'a-vencer',
    validado: 'ativo',
    expirado: 'inadimplente',
    cancelado: 'inadimplente',
  };

export function BadgeResgate({ status }: { status: StatusResgate }) {
  return (
    <Badge status={tomStatus[status]} label={rotuloStatusResgate[status]} />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  nota: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
