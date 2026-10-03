import { useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { ClipboardCheck, IdCard, LogIn, WifiOff } from 'lucide-react-native';
import type { RootNav } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
} from '../../components/ui';
import {
  formatarData,
  formatarDataHora,
  ocultarCpf,
  rotuloVeiculo,
} from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { alpha, palette, useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';
import {
  buscarCarteirinha,
  buscarMinhaSolicitacao,
  CacheCarteirinha,
  Carteirinha,
  girarToken,
  INTERVALO_TOKEN_MS,
  RETENTATIVA_TOKEN_MS,
  lerCache,
  limparCache,
  salvarCache,
  selo,
  urlVerificacao,
} from './api';

/** Aba Carteira: carteirinha digital da associação (substitui a física). */
export function CarteiraScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const { user, sairDoModoVisitante } = useAuth();
  const usuarioId = user?.id ?? null;

  const [cache, setCache] = useState<CacheCarteirinha | null>(null);
  const [cacheLido, setCacheLido] = useState(false);

  const consulta = useConsulta(
    usuarioId ? `carteirinha:${usuarioId}` : null,
    () => buscarCarteirinha(usuarioId!),
  );
  const solicitacao = useConsulta(
    usuarioId ? `solicitacao:${usuarioId}` : null,
    () => buscarMinhaSolicitacao(usuarioId!),
  );

  // Abre na hora com o que estiver salvo no celular (modo offline).
  useEffect(() => {
    if (!usuarioId) {
      return;
    }
    let ativo = true;
    lerCache(usuarioId).then(c => {
      if (ativo) {
        setCache(c);
        setCacheLido(true);
      }
    });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  // Toda busca que deu certo atualiza o cache.
  useEffect(() => {
    if (!usuarioId || consulta.dados === undefined) {
      return;
    }
    if (consulta.dados) {
      salvarCache(usuarioId, consulta.dados).then(() =>
        lerCache(usuarioId).then(setCache),
      );
    } else {
      // Deixou de ser associado: não mostra carteirinha velha offline.
      limparCache();
      setCache(null);
    }
  }, [usuarioId, consulta.dados]);

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={IdCard}
          title="Entre pra ver sua carteirinha"
          description="A carteirinha é do associado. Crie sua conta e peça a filiação."
          action={
            <Button
              title="Entrar ou criar conta"
              icon={<LogIn size={16} color={colors.primaryForeground} />}
              onPress={sairDoModoVisitante}
            />
          }
        />
      </Screen>
    );
  }

  const usandoCache = consulta.dados === undefined && !!cache && consulta.erro;
  const carteirinha: Carteirinha | null =
    consulta.dados !== undefined ? consulta.dados : cache?.dados ?? null;

  if (!carteirinha && (consulta.carregando || !cacheLido)) {
    return (
      <Screen>
        <Skeleton height={380} radius={22} />
      </Screen>
    );
  }

  if (!carteirinha && consulta.erro) {
    return (
      <Screen>
        <ErrorState
          title="Não deu pra abrir sua carteirinha"
          description="Pode ser a conexão. Assim que voltar, ela aparece aqui — e fica salva no celular pra abrir sem internet."
          onRetry={() => consulta.recarregar()}
        />
      </Screen>
    );
  }

  if (!carteirinha) {
    const pendente = solicitacao.dados?.status === 'pendente';
    return (
      <Screen
        onRefresh={() =>
          Promise.all([consulta.recarregar(true), solicitacao.recarregar(true)])
        }
      >
        {pendente ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Seu pedido está na fila"
            description={`A diretoria da ${
              solicitacao.dados?.associacao?.sigla ?? 'associação'
            } vai analisar. Quando aprovar, sua carteirinha aparece aqui.`}
          />
        ) : (
          <EmptyState
            icon={IdCard}
            title="Você ainda não é associado"
            description="Filie-se à ASSEMAG pra ter carteirinha digital, benefício exclusivo e apoio da diretoria."
            action={
              <Button
                title="Quero me filiar"
                onPress={() => navigation.navigate('Filiacao')}
              />
            }
          />
        )}
        {solicitacao.dados?.status === 'rejeitada' ? (
          <Text variant="small" tone="muted">
            Seu último pedido não foi aprovado
            {solicitacao.dados.observacao
              ? `: ${solicitacao.dados.observacao}`
              : '.'}{' '}
            Você pode pedir de novo.
          </Text>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => consulta.recarregar(true)}>
      <CartaoCarteirinha
        carteirinha={carteirinha}
        onVoltouConexao={() => consulta.recarregar(true)}
      />

      {usandoCache ? (
        <View
          style={[
            styles.aviso,
            {
              borderColor: alpha(palette.warning, 0.4),
              backgroundColor: alpha(palette.warning, 0.1),
            },
          ]}
        >
          <WifiOff size={20} color={colors.warning} />
          <Text variant="small" style={styles.flex}>
            Sem internet. Mostrando a última sincronização em{' '}
            <Text variant="small" style={styles.bold}>
              {formatarDataHora(cache?.sincronizadoEm)}
            </Text>
            .
          </Text>
        </View>
      ) : null}

      {/*
        TODO(pagamentos): seção "Mensalidade" — situação, histórico e "Pagar com Pix".
        Depende do gateway (Asaas ou Mercado Pago). Consulta pronta no web:
        goias-delivery-link/src/lib/carteirinha.ts → minhasMensalidadesQuery.
      */}
    </Screen>
  );
}

function CartaoCarteirinha({
  carteirinha,
  onVoltouConexao,
}: {
  carteirinha: Carteirinha;
  /** Chamado quando o token volta a sair depois de uma falha (internet voltou). */
  onVoltouConexao?: () => void;
}) {
  const { colors, radius } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const s = selo(carteirinha.status);
  const assoc = carteirinha.associacao;
  const cor = assoc?.cor_primaria || palette.green;
  const usuario = carteirinha.usuario;

  const voltouRef = useRef(onVoltouConexao);
  voltouRef.current = onVoltouConexao;

  // Token opaco novo a cada 60s. Sem internet, some o QR (token velho expira no
  // banco) e tenta de novo em 8s. Ao voltar do background gira na hora: os
  // timers ficam parados com o app em segundo plano e o QR estaria vencido.
  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let estavaSemConexao = false;

    async function girar() {
      clearTimeout(timer);
      try {
        const novo = await girarToken(carteirinha.id);
        if (!ativo) {
          return;
        }
        setToken(novo);
        setSemConexao(false);
        if (estavaSemConexao) {
          estavaSemConexao = false;
          voltouRef.current?.();
        }
        timer = setTimeout(girar, INTERVALO_TOKEN_MS);
      } catch {
        if (!ativo) {
          return;
        }
        setToken(null);
        setSemConexao(true);
        estavaSemConexao = true;
        timer = setTimeout(girar, RETENTATIVA_TOKEN_MS);
      }
    }

    girar();
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') {
        girar();
      }
    });
    return () => {
      ativo = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [carteirinha.id]);

  return (
    <View
      style={[
        styles.cartao,
        {
          borderRadius: radius['2xl'],
          borderColor: alpha(cor, 0.35),
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={[styles.faixa, { backgroundColor: cor }]}>
        <View style={styles.assoc}>
          {assoc?.logo_url ? (
            <Image
              source={{ uri: assoc.logo_url }}
              accessibilityIgnoresInvertColors
              style={[styles.logo, { borderRadius: radius.md }]}
            />
          ) : (
            <View
              style={[
                styles.logo,
                styles.logoVazio,
                { borderRadius: radius.md },
              ]}
            >
              <Text variant="title" style={styles.branco}>
                {assoc?.sigla?.slice(0, 3) ?? 'ASS'}
              </Text>
            </View>
          )}
          <View style={styles.flex}>
            <Text variant="h3" style={styles.branco} numberOfLines={1}>
              {assoc?.sigla ?? 'Associação'}
            </Text>
            <Text
              variant="caption"
              style={styles.brancoSuave}
              numberOfLines={1}
            >
              {assoc?.nome ?? 'Carteirinha digital'}
            </Text>
          </View>
        </View>
        <Badge status={s.tom} label={s.texto} />
      </View>

      <View style={styles.pessoa}>
        {usuario?.foto_url ? (
          <Image
            source={{ uri: usuario.foto_url }}
            accessibilityIgnoresInvertColors
            style={[styles.foto, { borderRadius: radius.md }]}
          />
        ) : (
          <View
            style={[
              styles.foto,
              styles.fotoVazia,
              { borderRadius: radius.md, backgroundColor: colors.muted },
            ]}
          >
            <Text variant="h1" tone="muted">
              {(usuario?.nome ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={2}>
            {usuario?.nome || 'Associado CORRE'}
          </Text>
          <Text variant="caption" tone="muted">
            CPF {ocultarCpf(usuario?.cpf)}
          </Text>
          <Text variant="title" style={[styles.numero, { color: cor }]}>
            Nº {carteirinha.numero_carteirinha}
          </Text>
        </View>
      </View>

      <View style={[styles.dados, { borderTopColor: colors.border }]}>
        <Dado
          rotulo="Validade"
          valor={formatarData(carteirinha.validade_carteirinha) ?? 'Sem prazo'}
        />
        <Dado
          rotulo="Veículo"
          valor={rotuloVeiculo[usuario?.tipo_veiculo ?? ''] ?? '—'}
        />
        <Dado rotulo="Placa" valor={usuario?.placa?.toUpperCase() || '—'} />
      </View>

      <View
        style={[
          styles.qrBox,
          { borderRadius: radius['2xl'], backgroundColor: palette.white },
        ]}
      >
        {token ? (
          <QRCode value={urlVerificacao(token)} size={168} ecl="M" />
        ) : (
          <View style={[styles.qrVazio, { borderRadius: radius.md }]}>
            <Text variant="caption" style={styles.qrTexto}>
              {semConexao
                ? 'Sem internet: o QR volta quando conectar. Os dados acima valem como identificação.'
                : 'Gerando seu código…'}
            </Text>
          </View>
        )}
        <Text variant="caption" style={styles.qrTexto}>
          Código novo a cada 60 segundos. Print de tela não vale.
        </Text>
      </View>

      {/* TODO(fase-2): selos de formação (cursos concluídos) no rodapé da carteirinha. */}
    </View>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.flex}>
      <Text variant="caption" tone="muted">
        {rotulo}
      </Text>
      <Text variant="title" numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  bold: { fontWeight: '700' },
  branco: { color: palette.white },
  brancoSuave: { color: alpha(palette.white, 0.8) },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  cartao: { borderWidth: 1, overflow: 'hidden' },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  assoc: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, backgroundColor: alpha(palette.white, 0.9) },
  logoVazio: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(palette.white, 0.2),
  },
  pessoa: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  foto: { width: 80, height: 80 },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  numero: { marginTop: 4 },
  dados: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  qrBox: {
    alignItems: 'center',
    gap: 12,
    margin: 20,
    marginTop: 0,
    padding: 24,
  },
  qrVazio: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d5d8de',
    padding: 12,
  },
  qrTexto: { color: '#6b7280', textAlign: 'center', fontWeight: '500' },
});
