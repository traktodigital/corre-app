import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import {
  Button,
  InlineError,
  Input,
  Text,
  TextInputRef,
} from '../../components/ui';
import { AuthLayout } from './AuthLayout';
import { useAuth } from './AuthProvider';
import { Aviso } from './Aviso';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { entrar, recuperarSenha } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const senhaRef = useRef<TextInputRef>(null);

  async function onEntrar() {
    setErro(null);
    setAviso(null);
    if (!email.trim() || !senha) {
      setErro('Preenche e-mail e senha pra entrar.');
      return;
    }
    setEnviando(true);
    const { erro: e } = await entrar(email, senha);
    setEnviando(false);
    // Sucesso: o AuthProvider troca a sessão e o App abre a Home.
    if (e) {
      setErro(e);
    }
  }

  async function onEsqueci() {
    setErro(null);
    setAviso(null);
    const { erro: e } = await recuperarSenha(email);
    if (e) {
      setErro(e);
    } else {
      setAviso('Link enviado. Olha sua caixa de e-mail.');
    }
  }

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entra pra ver seus descontos e sua carteirinha."
      footer={
        <Pressable
          accessibilityRole="link"
          onPress={() => navigation.replace('Signup')}
        >
          <Text variant="small" tone="muted">
            Ainda não tem conta?{' '}
            <Text variant="small" tone="highlight" style={styles.bold}>
              Criar conta
            </Text>
          </Text>
        </Pressable>
      }
    >
      <Input
        label="E-mail"
        placeholder="voce@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => senhaRef.current?.focus()}
      />
      <Input
        ref={senhaRef}
        label="Senha"
        placeholder="Sua senha"
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onEntrar}
      />

      <View style={styles.forgot}>
        <Pressable accessibilityRole="button" onPress={onEsqueci} hitSlop={8}>
          <Text variant="small" tone="highlight" style={styles.bold}>
            Esqueci minha senha
          </Text>
        </Pressable>
      </View>

      {erro ? <InlineError text={erro} /> : null}
      {aviso ? <Aviso text={aviso} /> : null}

      <Button
        size="lg"
        title={enviando ? 'Entrando...' : 'Entrar'}
        loading={enviando}
        onPress={onEntrar}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'flex-end', marginTop: -4 },
  bold: { fontWeight: '700' },
});
