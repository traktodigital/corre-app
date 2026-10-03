import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  BadgePercent,
  CalendarClock,
  IdCard,
  LogIn,
} from 'lucide-react-native';
import type { ScreenProps } from '../../app/navigation';
import { Screen } from '../../components/layout';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineError,
  ListSkeleton,
  Text,
} from '../../components/ui';
import { formatarData } from '../../lib/formato';
import { useConsulta } from '../../lib/useConsulta';
import { useTheme } from '../../theme';
import { useAuth } from '../auth/AuthProvider';
import {
  buscarOferta,
  criarResgate,
  MINUTOS_VALIDADE,
  resumoDesconto,
} from './api';

export function OfertaScreen({ route, navigation }: ScreenProps<'Oferta'>) {
  const { id } = route.params;
  const { colors } = useTheme();
  const { user, sairDoModoVisitante } = useAuth();
  const oferta = useConsulta(`oferta:${id}`, () => buscarOferta(id));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<{
    motivo: string;
    precisaAssociar?: boolean;
  } | null>(null);

  async function resgatar() {
    if (!user) {
      return;
    }
    setErro(null);
    setGerando(true);
    try {
      const r = await criarResgate(id, user.id);
      if (r.ok) {
        navigation.navigate('Resgate', { id: r.resgateId });
      } else {
        // TODO(pagamentos): r.precisaPremium → levar para a assinatura quando existir.
        setErro({ motivo: r.motivo, precisaAssociar: r.precisaAssociar });
      }
    } catch {
      setErro({ motivo: 'A internet oscilou. Tenta de novo em instantes.' });
    } finally {
      setGerando(false);
    }
  }

  if (oferta.carregando) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }
  if (oferta.erro && oferta.dados === undefined) {
    return (
      <Screen>
        <ErrorState onRetry={() => oferta.recarregar()} />
      </Screen>
    );
  }
  const o = oferta.dados;
  if (!o) {
    return (
      <Screen>
        <EmptyState
          icon={BadgePercent}
          title="Oferta encerrada"
          description="Essa oferta saiu do ar. Tem outras esperando por você."
          action={<Button title="Voltar" onPress={() => navigation.goBack()} />}
        />
      </Screen>
    );
  }

  const desconto = resumoDesconto(o);
  const validade = formatarData(o.validade_fim);
  const parceiroId = o.parceiro?.id;

  return (
    <Screen>
      <View style={styles.gap}>
        {o.exclusivo_associados ? (
          <Badge status="associado" label="Exclusivo associado" />
        ) : null}
        <Text variant="h1">{o.titulo}</Text>
        {o.parceiro && parceiroId ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => navigation.navigate('Parceiro', { id: parceiroId })}
          >
            <Text variant="small" tone="highlight" style={styles.bold}>
              {o.parceiro.nome_fantasia}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {desconto ? (
        <Card padding={20} glowing>
          <Text variant="caption" tone="muted">
            Seu benefício
          </Text>
          <Text variant="hero" tone="highlight">
            {desconto}
          </Text>
        </Card>
      ) : null}

      {o.descricao ? <Text variant="small">{o.descricao}</Text> : null}

      <Card style={styles.gap}>
        {validade ? (
          <View style={styles.info}>
            <CalendarClock size={16} color={colors.highlight} />
            <Text variant="small">Vale até {validade}</Text>
          </View>
        ) : null}
        <Text variant="small" tone="muted">
          O código gerado vale por {MINUTOS_VALIDADE} minutos. Gere só quando
          estiver no balcão.
        </Text>
        {o.regras ? (
          <Text variant="small" tone="muted">
            {o.regras}
          </Text>
        ) : null}
      </Card>

      {erro ? (
        <View style={styles.gap}>
          <InlineError text={erro.motivo} />
          {erro.precisaAssociar ? (
            <Button
              variant="outline"
              title="Quero me filiar à ASSEMAG"
              icon={<IdCard size={16} color={colors.foreground} />}
              onPress={() => navigation.navigate('Filiacao')}
            />
          ) : null}
        </View>
      ) : null}

      {user ? (
        <Button
          size="lg"
          title={gerando ? 'Gerando código...' : 'Resgatar agora'}
          loading={gerando}
          onPress={resgatar}
        />
      ) : (
        <Button
          size="lg"
          title="Entrar pra resgatar"
          icon={<LogIn size={16} color={colors.primaryForeground} />}
          onPress={sairDoModoVisitante}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 8 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700' },
});
