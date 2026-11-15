import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../../../app/navigation';
import { vehicleLabel } from '../../../../shared/format';
import { Button, Chip, InlineError, Input, Text } from '../../../../shared/ui';
import { maskPhone } from '../../domain/phone';
import {
  MIN_PASSWORD_LENGTH,
  nameWarning,
  validateSignUp,
} from '../../domain/signUpRules';
import type { VehicleType } from '../../domain/types';
import { useAuthActions } from '../AuthProvider';
import { AuthLayout } from '../components/AuthLayout';

const vehicleTypes: VehicleType[] = ['moto', 'bike', 'carro', 'a_pe'];

export function SignupScreen({ navigation }: ScreenProps<'Signup'>) {
  const { signUp } = useAuthActions();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [city, setCity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameHint = nameWarning(name);

  async function onCreate() {
    const invalid = validateSignUp({ name, email, phone, password, city });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await signUp({
      name,
      email,
      password,
      phone,
      city,
      vehicleType,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else if (result.needsConfirmation) {
      navigation.replace('ConfirmEmail', { email: email.trim() });
    }
  }

  return (
    <AuthLayout
      title="Cria sua conta"
      subtitle="Um minuto e você já resgata benefício na rua."
      footer={
        <Pressable
          accessibilityRole="link"
          onPress={() => navigation.replace('Login')}
        >
          <Text variant="small" tone="muted">
            Já tem conta?{' '}
            <Text variant="small" tone="highlight" style={styles.bold}>
              Entrar
            </Text>
          </Text>
        </Pressable>
      }
    >
      <Input
        label="Nome completo"
        placeholder="Seu nome"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      {nameHint ? (
        <Text variant="caption" tone="muted">
          {nameHint}
        </Text>
      ) : null}
      <Input
        label="E-mail"
        placeholder="voce@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Input
        label="Senha"
        placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Input
        label="Telefone"
        placeholder="(62) 9 9999-9999"
        value={phone}
        onChangeText={value => setPhone(maskPhone(value))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <View style={styles.group}>
        <Text variant="small" style={styles.semibold}>
          Como você roda?
        </Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {vehicleTypes.map(type => (
            <Chip
              key={type}
              label={vehicleLabel[type]}
              selected={vehicleType === type}
              onPress={() => setVehicleType(type)}
            />
          ))}
        </View>
      </View>

      <Input
        label="Cidade"
        placeholder="Goiânia"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
        textContentType="addressCity"
        returnKeyType="go"
        onSubmitEditing={onCreate}
      />

      {error ? <InlineError text={error} /> : null}

      <Button
        size="lg"
        title={submitting ? 'Criando...' : 'Criar conta'}
        loading={submitting}
        onPress={onCreate}
      />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  bold: { fontWeight: '700' },
  semibold: { fontWeight: '600' },
});
