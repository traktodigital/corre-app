import { StyleSheet, View } from 'react-native';
import { Gift, IdCard, Route } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Button, Card, IconBox, Text } from '../../components/ui';
import { useTheme } from '../../theme';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';

// Textos das telas /acesso e /onboarding do web.
const destaques = [
  {
    icon: Gift,
    titulo: 'Descontos de verdade no seu corre',
    texto:
      'Óleo, peça, lanche, oficina e capacete com preço de quem roda o dia inteiro.',
  },
  {
    icon: IdCard,
    titulo: 'Sua associação no bolso',
    texto:
      'Carteirinha digital com QR, mensalidade em dia e a papelada organizada.',
  },
  {
    icon: Route,
    titulo: 'Trabalho e benefício no mesmo app',
    texto: 'Acompanhe seus ganhos, resgates e formação num lugar só.',
  },
];

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { colors } = useTheme();
  const { explorarSemCadastro } = useAuth();

  return (
    <AuthLayout
      title="Bem-vindo ao CORRE"
      subtitle="O app de quem move a cidade. Desconto no que você usa, carteirinha na mão e o seu corre organizado."
      footer={
        <Button
          variant="ghost"
          title="Explorar sem cadastro"
          onPress={explorarSemCadastro}
        />
      }
    >
      <View style={styles.list}>
        {destaques.map(({ icon: Icon, titulo, texto }) => (
          <Card key={titulo} style={styles.row}>
            <IconBox>
              <Icon size={20} color={colors.highlight} />
            </IconBox>
            <View style={styles.flex}>
              <Text variant="title">{titulo}</Text>
              <Text variant="caption" tone="muted">
                {texto}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      <Button
        size="lg"
        title="Criar conta"
        onPress={() => navigation.navigate('Signup')}
      />
      <Button
        size="lg"
        variant="outline"
        title="Entrar"
        onPress={() => navigation.navigate('Login')}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
