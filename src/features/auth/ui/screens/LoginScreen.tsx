import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import {
  Button,
  InlineError,
  Input,
  Text,
  TextInputRef,
} from '../../../../shared/ui';
import { useAuthActions } from '../AuthProvider';
import { AuthLayout } from '../components/AuthLayout';
import { Notice } from '../components/Notice';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signIn, requestPasswordReset } = useAuthActions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInputRef>(null);

  async function onSignIn() {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Preenche e-mail e senha pra entrar.');
      return;
    }
    setSubmitting(true);
    const result = await signIn(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    }
  }

  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    const result = await requestPasswordReset(email);
    if (result.error) {
      setError(result.error);
    } else {
      setNotice('Link enviado. Olha sua caixa de e-mail.');
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
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        ref={passwordRef}
        label="Senha"
        placeholder="Sua senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSignIn}
      />

      <View style={styles.forgot}>
        <Pressable
          accessibilityRole="button"
          onPress={onForgotPassword}
          hitSlop={8}
        >
          <Text variant="small" tone="highlight" style={styles.bold}>
            Esqueci minha senha
          </Text>
        </Pressable>
      </View>

      {error ? <InlineError text={error} /> : null}
      {notice ? <Notice text={notice} /> : null}

      <Button
        size="lg"
        title={submitting ? 'Entrando...' : 'Entrar'}
        loading={submitting}
        onPress={onSignIn}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'flex-end', marginTop: -4 },
  bold: { fontWeight: '700' },
});
