import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ClipboardCheck } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { cpfValido, mascararCpf, soDigitos } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { alpha, palette, useTheme } from '../../theme';
import { TipoVeiculo, useAuth } from '../auth/AuthProvider';
import { mascararTelefone, telefoneValido } from '../auth/telefone';
import { buscarPerfil } from '../profile/api';
import {
  buscarMinhaSolicitacao,
  enviarFiliacao,
  listarAssociacoesAtivas,
} from './api';

const veiculos: { value: TipoVeiculo; label: string }[] = [
  { value: 'moto', label: 'Moto' },
  { value: 'bike', label: 'Bike' },
  { value: 'carro', label: 'Carro' },
  { value: 'a_pe', label: 'A pé' },
];

export function validarFiliacao(d: {
  associacaoId: string;
  nome: string;
  cpf: string;
  telefone: string;
  cidade: string;
  aceite: boolean;
}): string | null {
  if (!d.associacaoId) {
    return 'Escolha a associação.';
  }
  if (d.nome.trim().split(/\s+/).length < 2) {
    return 'Escreve seu nome completo, por favor.';
  }
  if (!cpfValido(d.cpf)) {
    return 'CPF inválido. Confere os números.';
  }
  if (!telefoneValido(d.telefone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos.';
  }
  if (!d.cidade.trim()) {
    return 'Qual a sua cidade?';
  }
  if (!d.aceite) {
    return 'Você precisa aceitar o estatuto pra continuar.';
  }
  return null;
}

export function FiliacaoScreen({ navigation }: ScreenProps<'Filiacao'>) {
  const { colors, radius } = useTheme();
  const { user } = useAuth();
  const usuarioId = user?.id ?? null;

  const associacoes = useConsulta(
    'associacoes-ativas',
    listarAssociacoesAtivas,
  );
  const solicitacao = useConsulta(
    usuarioId ? `solicitacao:${usuarioId}` : null,
    () => buscarMinhaSolicitacao(usuarioId!),
  );

  const [associacaoId, setAssociacaoId] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('GO');
  const [veiculo, setVeiculo] = useState<TipoVeiculo>('moto');
  const [placa, setPlaca] = useState('');
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Preenche com o que já está no cadastro.
  useEffect(() => {
    if (!usuarioId) {
      return;
    }
    buscarPerfil(usuarioId)
      .then(p => {
        if (!p) {
          return;
        }
        setNome(v => v || p.nome || '');
        setCpf(v => v || mascararCpf(p.cpf ?? ''));
        setTelefone(v => v || p.telefone || '');
        setCidade(v => v || p.cidade || '');
        setUf(v => p.uf || v);
        if (p.tipo_veiculo) {
          setVeiculo(p.tipo_veiculo);
        }
        setPlaca(v => v || p.placa || '');
      })
      .catch(() => {});
  }, [usuarioId]);

  useEffect(() => {
    const lista = associacoes.dados ?? [];
    if (!associacaoId && lista.length > 0) {
      setAssociacaoId(lista[0].id);
    }
  }, [associacoes.dados, associacaoId]);

  async function enviar() {
    if (!usuarioId) {
      return;
    }
    const invalido = validarFiliacao({
      associacaoId,
      nome,
      cpf,
      telefone,
      cidade,
      aceite,
    });
    if (invalido) {
      setErro(invalido);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await enviarFiliacao(usuarioId, {
        associacaoId,
        nome,
        cpf: soDigitos(cpf),
        telefone,
        cidade,
        uf,
        veiculo,
        placa,
      });
      navigation.goBack();
    } catch {
      setErro('Não deu pra enviar agora. Tenta de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  if (associacoes.carregando || solicitacao.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={3} />
      </Screen>
    );
  }

  if (associacoes.erro && !associacoes.dados) {
    return (
      <Screen>
        <ErrorState
          title="Não deu pra abrir a filiação"
          onRetry={() => associacoes.recarregar()}
        />
      </Screen>
    );
  }

  if (solicitacao.dados?.status === 'pendente') {
    return (
      <Screen>
        <EmptyState
          icon={ClipboardCheck}
          title="Seu pedido está na fila"
          description="A diretoria vai analisar. Enquanto isso, aproveite os benefícios abertos do clube."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const lista = associacoes.dados ?? [];

  return (
    <Screen>
      <View>
        <Text variant="h1">Filie-se</Text>
        <Text variant="small" tone="muted">
          Carteirinha digital, benefício exclusivo e apoio da diretoria. A
          associação analisa e aprova o seu pedido.
        </Text>
      </View>

      <View style={styles.form}>
        {lista.length > 1 ? (
          <View style={styles.grupo}>
            <Text variant="small" style={styles.semibold}>
              Associação
            </Text>
            <View style={styles.chips}>
              {lista.map(a => (
                <Chip
                  key={a.id}
                  label={a.sigla}
                  selected={associacaoId === a.id}
                  onPress={() => setAssociacaoId(a.id)}
                />
              ))}
            </View>
          </View>
        ) : lista.length === 1 ? (
          <Text variant="small">
            Associação:{' '}
            <Text variant="small" tone="highlight" style={styles.bold}>
              {lista[0].sigla} — {lista[0].nome}
            </Text>
          </Text>
        ) : (
          <InlineError text="Nenhuma associação aberta pra filiação agora." />
        )}

        <Input
          label="Nome completo"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Input
          label="CPF"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={v => setCpf(mascararCpf(v))}
          keyboardType="number-pad"
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

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: aceite }}
          onPress={() => setAceite(v => !v)}
          style={styles.aceite}
        >
          <View
            style={[
              styles.caixa,
              { borderRadius: radius.sm },
              aceite
                ? {
                    borderColor: colors.highlight,
                    backgroundColor: alpha(palette.green, 0.2),
                  }
                : { borderColor: colors.border },
            ]}
          >
            {aceite ? <Check size={14} color={colors.highlight} /> : null}
          </View>
          <Text variant="small" style={styles.flex}>
            Li e aceito o estatuto da associação e autorizo o uso dos meus dados
            para a filiação.
          </Text>
        </Pressable>
        {/* TODO(conteúdo): link para o PDF do estatuto quando a ASSEMAG enviar. */}

        {erro ? <InlineError text={erro} /> : null}

        <Button
          size="lg"
          title={enviando ? 'Enviando...' : 'Pedir filiação'}
          loading={enviando}
          disabled={lista.length === 0}
          onPress={enviar}
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
  bold: { fontWeight: '700' },
  aceite: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  caixa: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
});
