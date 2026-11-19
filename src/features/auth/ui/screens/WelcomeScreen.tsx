import { StyleSheet, View } from 'react-native';
import Gift from 'lucide-react-native/icons/gift';
import IdCard from 'lucide-react-native/icons/id-card';

import type { ScreenProps } from '../../../../app/navigation';
import { Button, Card, IconBox, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';
import { AuthLayout } from '../components/AuthLayout';

const highlights = [
  {
    icon: Gift,
    title: 'Descontos de verdade no seu corre',
    text: 'Óleo, peça, lanche, oficina e capacete com preço de quem roda o dia inteiro.',
  },
  {
    icon: IdCard,
    title: 'Sua associação no bolso',
    text: 'Carteirinha digital com QR, mensalidade em dia e a papelada organizada.',
  },
];

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  const { colors } = useTheme();

  return (
    <AuthLayout
      title="Bem-vindo ao Sou Corre"
      subtitle="O app de quem move a cidade. Desconto no que você usa, carteirinha na mão e o seu corre organizado."
    >
      <View style={styles.list}>
        {highlights.map(({ icon: Icon, title, text }) => (
          <Card key={title} style={styles.row}>
            <IconBox>
              <Icon size={20} color={colors.highlight} />
            </IconBox>
            <View style={styles.flex}>
              <Text variant="title">{title}</Text>
              <Text variant="caption" tone="muted">
                {text}
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
