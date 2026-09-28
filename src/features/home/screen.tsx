import { Pressable, StyleSheet, View } from 'react-native';
import {
  CalendarDays,
  Gift,
  GraduationCap,
  Handshake,
  Home,
  LucideIcon,
  Star,
  Store,
  Trophy,
} from 'lucide-react-native';
import { Screen } from '../../components/layout';
import {
  Badge,
  Card,
  EmptyState,
  IconBox,
  ProgressBar,
  SectionTitle,
  Text,
} from '../../components/ui';
import { alpha, palette, useTheme } from '../../theme';
import { primeiroNome, useAuth } from '../auth/AuthProvider';

// Dados de exemplo — trocados pelas consultas ao backend na próxima etapa.
const mock = {
  economia: 'R$ 0,00',
  progresso: 0,
  ofertas: [
    {
      id: '1',
      titulo: '10% na troca de óleo',
      parceiro: 'Oficina do Zé',
      exclusivo: true,
    },
    {
      id: '2',
      titulo: 'Lanche + refri por R$ 15',
      parceiro: 'Lanchonete Goiás',
      exclusivo: false,
    },
  ],
  parceiros: [
    {
      id: '1',
      nome: 'Posto Central',
      local: 'Setor Bueno · Goiânia',
      distancia: '850 m',
      nota: 4.8,
    },
    {
      id: '2',
      nome: 'Moto Peças 62',
      local: 'Centro · Goiânia',
      distancia: '2.3 km',
      nota: 4.5,
    },
  ],
};

const atalhos: { label: string; icon: LucideIcon }[] = [
  { label: 'Benefícios', icon: Gift },
  { label: 'Formação', icon: GraduationCap },
  { label: 'Casa própria', icon: Home },
  { label: 'Parcerias', icon: Handshake },
];

export function HomeScreen() {
  const { colors, radius } = useTheme();
  const { user } = useAuth();

  return (
    <Screen>
      <Card padding={20} glowing>
        <Text variant="h1">Olá, {primeiroNome(user)}!</Text>
        <Text variant="small" tone="muted">
          Bom corre hoje. Bora economizar?
        </Text>

        <View
          style={[
            styles.savings,
            {
              borderRadius: radius['2xl'],
              backgroundColor: alpha(palette.black, 0.6),
            },
          ]}
        >
          <Text variant="small" tone="muted">
            Você já economizou
          </Text>
          <Text variant="hero" tone="highlight">
            {mock.economia}
          </Text>
          <Text variant="caption" tone="muted" style={styles.mt1}>
            {user
              ? 'Soma dos descontos já validados no balcão'
              : 'Crie sua conta pra começar a somar seus descontos'}
          </Text>
        </View>
      </Card>

      <Card padding={20}>
        <View style={styles.row}>
          <IconBox size={40}>
            <Trophy size={20} color={colors.highlight} />
          </IconBox>
          <View style={styles.flex}>
            <Text variant="h3">Nível Bronze</Text>
            <Text variant="caption" tone="muted">
              Use 5 benefícios no mês e suba pra Prata
            </Text>
          </View>
        </View>
        <View style={styles.mt4}>
          <ProgressBar value={mock.progresso} />
        </View>
        <Text variant="caption" tone="muted" style={styles.mt2}>
          Falta pouco: cada resgate validado empurra sua barra.
        </Text>
      </Card>

      <View>
        <SectionTitle hint="acesso rápido">Bora começar</SectionTitle>
        <View style={styles.grid}>
          {atalhos.map(({ label, icon: Icon }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              style={[
                styles.shortcut,
                {
                  borderRadius: radius['2xl'],
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Icon size={20} color={colors.highlight} />
              <Text variant="tiny" style={styles.center} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle hint="ofertas do clube">Ofertas em destaque</SectionTitle>
        <View style={styles.list}>
          {mock.ofertas.map(o => (
            <Card key={o.id} style={styles.row}>
              <IconBox>
                <Store size={20} color={colors.highlight} />
              </IconBox>
              <View style={styles.flex}>
                <Text variant="title" numberOfLines={1}>
                  {o.titulo}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {o.parceiro}
                </Text>
              </View>
              {o.exclusivo ? (
                <Badge status="associado" label="Associado" />
              ) : null}
            </Card>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle hint="por distância">Perto de você</SectionTitle>
        <View style={styles.list}>
          {mock.parceiros.map(p => (
            <Card key={p.id} style={styles.row}>
              <IconBox tone="neutral">
                <Store size={20} color={colors.highlight} />
              </IconBox>
              <View style={styles.flex}>
                <Text variant="title" numberOfLines={1}>
                  {p.nome}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {p.local}
                </Text>
              </View>
              <View style={styles.right}>
                <Text variant="caption" tone="highlight" style={styles.bold}>
                  {p.distancia}
                </Text>
                <View style={styles.rating}>
                  <Star size={12} color={colors.mutedForeground} />
                  <Text variant="tiny" tone="muted">
                    {p.nota.toFixed(1)}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View>
        <SectionTitle>Próximo evento</SectionTitle>
        <EmptyState
          icon={CalendarDays}
          title="Sem evento marcado"
          description="Encontro, assembleia e ação na rua caem direto neste card."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  savings: { marginTop: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', gap: 12 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 16,
  },
  list: { gap: 12 },
  right: { alignItems: 'flex-end' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  mt1: { marginTop: 4 },
  mt2: { marginTop: 8 },
  mt4: { marginTop: 16 },
});
