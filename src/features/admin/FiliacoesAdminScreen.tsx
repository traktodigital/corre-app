import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ClipboardCheck, UserRoundCheck } from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  InlineError,
  Input,
  ListSkeleton,
  Text,
} from '../../components/ui';
import {
  formatarDataHora,
  mascararCpf,
  rotuloVeiculo,
} from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';
import {
  aprovarPedidoFiliacao,
  listarAssociacoesAdministradas,
  listarPedidosPendentes,
  MIN_MOTIVO_RECUSA,
  motivoFiliacao,
  PedidoFiliacao,
  rejeitarPedidoFiliacao,
} from './api';

export function FiliacoesAdminScreen({}: ScreenProps<'FiliacoesAdmin'>) {
  const { user, associacoesAdministradas } = useAuth();
  const [associacaoId, setAssociacaoId] = useState('');
  const [acaoId, setAcaoId] = useState<string | null>(null);
  const [rejeicaoId, setRejeicaoId] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const associacoes = useConsulta(
    user && associacoesAdministradas.length > 0
      ? `associacoes-admin:${user.id}`
      : null,
    () => listarAssociacoesAdministradas(associacoesAdministradas),
  );
  const disponiveis = associacoes.dados ?? [];
  const selecionada = useMemo(() => {
    if (disponiveis.some(a => a.id === associacaoId)) {
      return associacaoId;
    }
    return disponiveis[0]?.id ?? '';
  }, [associacaoId, disponiveis]);
  const pedidos = useConsulta(
    selecionada ? `pedidos-filiacao:${selecionada}` : null,
    () => listarPedidosPendentes(selecionada),
  );

  async function falhou(e: unknown) {
    const { motivo, recarregar } = motivoFiliacao(
      String((e as { message?: string } | null)?.message ?? ''),
    );
    setErroAcao(motivo);
    if (recarregar) {
      setRejeicaoId(null);
      setObservacao('');
      await pedidos.recarregar(true);
    }
  }

  async function aprovar(pedido: PedidoFiliacao) {
    setErroAcao(null);
    setAcaoId(pedido.id);
    try {
      await aprovarPedidoFiliacao(pedido.id);
      await pedidos.recarregar(true);
    } catch (e) {
      await falhou(e);
    } finally {
      setAcaoId(null);
    }
  }

  function confirmarAprovacao(pedido: PedidoFiliacao) {
    Alert.alert(
      'Aprovar filiação?',
      `A aprovação cria o vínculo de ${pedido.nome} com a associação e libera a carteirinha digital.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aprovar', onPress: () => void aprovar(pedido) },
      ],
    );
  }

  async function rejeitar(pedido: PedidoFiliacao) {
    if (observacao.trim().length < MIN_MOTIVO_RECUSA) {
      setErroAcao(
        `Escreva o motivo da recusa (mínimo ${MIN_MOTIVO_RECUSA} letras) para avisar a pessoa.`,
      );
      return;
    }
    setErroAcao(null);
    setAcaoId(pedido.id);
    try {
      await rejeitarPedidoFiliacao(pedido.id, observacao);
      setRejeicaoId(null);
      setObservacao('');
      await pedidos.recarregar(true);
    } catch (e) {
      await falhou(e);
    } finally {
      setAcaoId(null);
    }
  }

  if (!user || associacoesAdministradas.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={ClipboardCheck}
          title="Acesso restrito"
          description="Esta área está disponível para pessoas com permissão de administração da associação."
        />
      </Screen>
    );
  }

  if (associacoes.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }

  if (associacoes.erro && !associacoes.dados) {
    return (
      <Screen>
        <ErrorState onRetry={() => associacoes.recarregar()} />
      </Screen>
    );
  }

  if (disponiveis.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={ClipboardCheck}
          title="Associação não encontrada"
          description="Sua conta tem uma permissão de administração, mas não conseguimos carregar a associação vinculada."
        />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() =>
        Promise.all([associacoes.recarregar(true), pedidos.recarregar(true)])
      }
    >
      <View>
        <Text variant="h1">Pedidos de filiação</Text>
        <Text variant="small" tone="muted">
          Confira os dados e aprove ou recuse cada pedido.
        </Text>
      </View>

      {disponiveis.length > 1 ? (
        <View style={styles.grupo}>
          <Text variant="small" style={styles.semibold}>
            Associação
          </Text>
          <View style={styles.chips}>
            {disponiveis.map(a => (
              <Chip
                key={a.id}
                label={a.sigla}
                selected={selecionada === a.id}
                onPress={() => setAssociacaoId(a.id)}
              />
            ))}
          </View>
        </View>
      ) : (
        <Text variant="small" tone="highlight" style={styles.semibold}>
          {disponiveis[0].sigla} — {disponiveis[0].nome}
        </Text>
      )}

      {erroAcao ? <InlineError text={erroAcao} /> : null}

      {pedidos.carregando ? (
        <ListSkeleton rows={3} />
      ) : pedidos.erro && !pedidos.dados ? (
        <ErrorState onRetry={() => pedidos.recarregar()} />
      ) : (pedidos.dados ?? []).length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum pedido pendente"
          description="Quando alguém pedir para se filiar, o pedido vai aparecer aqui."
        />
      ) : (
        <View style={styles.lista}>
          {pedidos.dados!.map(pedido => (
            <CardPedido
              key={pedido.id}
              pedido={pedido}
              ocupada={acaoId !== null}
              salvando={acaoId === pedido.id}
              rejeitando={rejeicaoId === pedido.id}
              observacao={rejeicaoId === pedido.id ? observacao : ''}
              onAprovar={() => confirmarAprovacao(pedido)}
              onIniciarRejeicao={() => {
                setErroAcao(null);
                setRejeicaoId(pedido.id);
                setObservacao('');
              }}
              onCancelarRejeicao={() => {
                setRejeicaoId(null);
                setObservacao('');
              }}
              onObservacao={setObservacao}
              onRejeitar={() => rejeitar(pedido)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function CardPedido({
  pedido,
  ocupada,
  salvando,
  rejeitando,
  observacao,
  onAprovar,
  onIniciarRejeicao,
  onCancelarRejeicao,
  onObservacao,
  onRejeitar,
}: {
  pedido: PedidoFiliacao;
  ocupada: boolean;
  salvando: boolean;
  rejeitando: boolean;
  observacao: string;
  onAprovar: () => void;
  onIniciarRejeicao: () => void;
  onCancelarRejeicao: () => void;
  onObservacao: (value: string) => void;
  onRejeitar: () => void;
}) {
  const { colors } = useTheme();
  const veiculo = pedido.tipo_veiculo
    ? rotuloVeiculo[pedido.tipo_veiculo] ?? pedido.tipo_veiculo
    : null;

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <View style={styles.flex}>
          <Text variant="h3">{pedido.nome}</Text>
          <Text variant="caption" tone="muted">
            Pedido em{' '}
            {formatarDataHora(pedido.criado_em) ?? 'data indisponível'}
          </Text>
        </View>
        <UserRoundCheck size={20} color={colors.highlight} />
      </View>

      <View style={styles.dados}>
        <Linha
          rotulo="CPF"
          valor={pedido.cpf ? mascararCpf(pedido.cpf) : null}
        />
        <Linha rotulo="Telefone" valor={pedido.telefone} />
        <Linha
          rotulo="Cidade"
          valor={[pedido.cidade, pedido.uf].filter(Boolean).join(' / ')}
        />
        <Linha rotulo="Veículo" valor={veiculo} />
        <Linha rotulo="Placa" valor={pedido.placa} />
      </View>

      {rejeitando ? (
        <View style={styles.formRejeicao}>
          <Input
            label="Motivo da recusa"
            value={observacao}
            onChangeText={onObservacao}
            multiline
            maxLength={500}
            textAlignVertical="top"
            style={styles.textarea}
          />
          <View style={styles.acoes}>
            <Button
              variant="outline"
              title="Cancelar"
              disabled={ocupada}
              onPress={onCancelarRejeicao}
            />
            <Button
              variant="destructive"
              title={salvando ? 'Recusando...' : 'Confirmar recusa'}
              loading={salvando}
              disabled={ocupada}
              onPress={onRejeitar}
            />
          </View>
        </View>
      ) : (
        <View style={styles.acoes}>
          <Button
            variant="outline"
            title="Recusar"
            disabled={ocupada}
            onPress={onIniciarRejeicao}
          />
          <Button
            title={salvando ? 'Aprovando...' : 'Aprovar filiação'}
            loading={salvando}
            disabled={ocupada}
            onPress={onAprovar}
          />
        </View>
      )}
    </Card>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) {
    return null;
  }
  return (
    <View style={styles.linha}>
      <Text variant="caption" tone="muted">
        {rotulo}
      </Text>
      <Text variant="small" style={styles.valor}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  semibold: { fontWeight: '700' },
  lista: { gap: 12 },
  card: { gap: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  dados: { gap: 8 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  valor: { flex: 1, textAlign: 'right' },
  acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  formRejeicao: { gap: 12 },
  textarea: { height: 96, paddingTop: 12 },
});
