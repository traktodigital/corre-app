import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { Button, Chip, InlineError, Input, Text } from '../../components/ui';
import { AuthLayout } from './AuthLayout';
import { TipoVeiculo, useAuth } from './AuthProvider';
import { mascararTelefone, telefoneValido } from './telefone';

const veiculos: { value: TipoVeiculo; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'bike', label: 'Bike' },
  { value: 'carro', label: 'Carro' },
  { value: 'a_pe', label: 'A pé' },
];

/** Regras de /criar-conta do web, na mesma ordem. */
export function validarCadastro(d: {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  cidade: string;
}): string | null {
  if (!d.nome.trim() || !d.email.trim() || !d.cidade.trim()) {
    return 'Preenche todos os campos, por favor.';
  }
  if (!telefoneValido(d.telefone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos, tipo (62) 9 9999-9999.';
  }
  if (d.senha.length < SENHA_MINIMA) {
    return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  return null;
}

export const SENHA_MINIMA = 8;

/** Nome de uma palavra só existe: avisa, não bloqueia. */
export function avisoNome(nome: string): string | null {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return partes.length === 1
    ? 'Se tiver sobrenome, coloca também — ajuda na carteirinha.'
    : null;
}

export function SignupScreen({ navigation }: ScreenProps<'Signup'>) {
  const { criarConta } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [veiculo, setVeiculo] = useState<TipoVeiculo>('moto');
  const [cidade, setCidade] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function onCriar() {
    const invalido = validarCadastro({ nome, email, telefone, senha, cidade });
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setEnviando(true);
    const r = await criarConta({
      nome,
      email,
      senha,
      telefone,
      cidade,
      veiculo,
    });
    setEnviando(false);
    if (r.erro) {
      setErro(r.erro);
    } else if (r.precisaConfirmar) {
      navigation.replace('ConfirmEmail', { email: email.trim() });
    }
    // Sem confirmação: a sessão já existe e o App abre a Home.
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
        value={nome}
        onChangeText={setNome}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      {avisoNome(nome) ? (
        <Text variant="caption" tone="muted">
          {avisoNome(nome)}
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
        placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Input
        label="Telefone"
        placeholder="(62) 9 9999-9999"
        value={telefone}
        onChangeText={v => setTelefone(mascararTelefone(v))}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />

      <View style={styles.group}>
        <Text variant="small" style={styles.semibold}>
          Como você roda?
        </Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {veiculos.map(v => (
            <Chip
              key={v.value}
              label={v.label}
              selected={veiculo === v.value}
              onPress={() => setVeiculo(v.value)}
            />
          ))}
        </View>
      </View>

      <Input
        label="Cidade"
        placeholder="Goiânia"
        value={cidade}
        onChangeText={setCidade}
        autoCapitalize="words"
        textContentType="addressCity"
        returnKeyType="go"
        onSubmitEditing={onCriar}
      />

      {erro ? <InlineError text={erro} /> : null}

      <Button
        size="lg"
        title={enviando ? 'Criando...' : 'Criar conta'}
        loading={enviando}
        onPress={onCriar}
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
