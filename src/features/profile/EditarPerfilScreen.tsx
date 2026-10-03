import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Chip,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { useConsulta } from '../../lib/useConsulta';
import { TipoVeiculo, useAuth } from '../auth/AuthProvider';
import { mascararTelefone, telefoneValido } from '../auth/telefone';
import { buscarPerfil, salvarPerfil } from './api';

const veiculos: { value: TipoVeiculo; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'bike', label: 'Bike' },
  { value: 'carro', label: 'Carro' },
  { value: 'a_pe', label: 'A pé' },
];

export function validarPerfil(d: {
  nome: string;
  telefone: string;
  cidade: string;
}): string | null {
  if (d.nome.trim().split(/\s+/).length < 2) {
    return 'Escreve seu nome completo, por favor.';
  }
  if (!telefoneValido(d.telefone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos.';
  }
  if (!d.cidade.trim()) {
    return 'Qual a sua cidade?';
  }
  return null;
}

export function EditarPerfilScreen({
  navigation,
}: ScreenProps<'EditarPerfil'>) {
  const { user } = useAuth();
  const usuarioId = user?.id ?? null;
  const perfil = useConsulta(usuarioId ? `perfil:${usuarioId}` : null, () =>
    buscarPerfil(usuarioId!),
  );

  const [preenchido, setPreenchido] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('GO');
  const [veiculo, setVeiculo] = useState<TipoVeiculo>('moto');
  const [placa, setPlaca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Preenche uma vez só — o refetch ao focar não pode apagar o que foi digitado.
  useEffect(() => {
    const p = perfil.dados;
    if (!p || preenchido) {
      return;
    }
    setNome(p.nome ?? '');
    setTelefone(p.telefone ?? '');
    setCidade(p.cidade ?? '');
    setUf(p.uf ?? 'GO');
    setVeiculo(p.tipo_veiculo ?? 'moto');
    setPlaca(p.placa ?? '');
    setPreenchido(true);
  }, [perfil.dados, preenchido]);

  async function salvar() {
    if (!usuarioId) {
      return;
    }
    const invalido = validarPerfil({ nome, telefone, cidade });
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await salvarPerfil(usuarioId, {
        nome,
        telefone,
        cidade,
        uf,
        tipo_veiculo: veiculo,
        placa: veiculo === 'moto' || veiculo === 'carro' ? placa : '',
      });
      navigation.goBack();
    } catch {
      setErro('Não deu pra salvar agora. Tenta de novo em instantes.');
    } finally {
      setSalvando(false);
    }
  }

  if (perfil.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }
  if (perfil.erro && !perfil.dados) {
    return (
      <Screen>
        <ErrorState onRetry={() => perfil.recarregar()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.form}>
        <Input
          label="Nome completo"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Input
          label="Telefone"
          placeholder="(62) 9 9999-9999"
          value={telefone}
          onChangeText={v => setTelefone(mascararTelefone(v))}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        <View style={styles.linha}>
          <View style={styles.flex}>
            <Input
              label="Cidade"
              value={cidade}
              onChangeText={setCidade}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.uf}>
            <Input
              label="UF"
              value={uf}
              onChangeText={v => setUf(v.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>

        <View style={styles.grupo}>
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

        {veiculo === 'moto' || veiculo === 'carro' ? (
          <Input
            label="Placa"
            placeholder="ABC1D23"
            value={placa}
            onChangeText={v => setPlaca(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={8}
          />
        ) : null}

        <Text variant="caption" tone="muted">
          E-mail e CPF não mudam por aqui. Precisa trocar? Fala com o suporte
          CORRE.
        </Text>

        {erro ? <InlineError text={erro} /> : null}

        <Button
          size="lg"
          title={salvando ? 'Salvando...' : 'Salvar'}
          loading={salvando}
          onPress={salvar}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  grupo: { gap: 6 },
  chips: { flexDirection: 'row', gap: 8 },
  linha: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  uf: { width: 80 },
  semibold: { fontWeight: '600' },
});
