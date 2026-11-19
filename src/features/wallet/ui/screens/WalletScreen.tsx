import { useNavigation } from '@react-navigation/native';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import IdCard from 'lucide-react-native/icons/id-card';
import LogIn from 'lucide-react-native/icons/log-in';
import type { RootNav } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { useSession } from '../../../auth';
import {
  fetchLatestMembershipRequest,
  fetchMembershipCard,
} from '../../data/walletRepository';
import {
  CACHE_MAX_DAYS,
  isCacheExpired,
  type MembershipCard,
} from '../../domain';
import { MembershipCardView } from '../components/MembershipCardView';
import { OfflineNotice } from '../components/OfflineNotice';
import { useCardCache } from '../hooks/useCardCache';

export function WalletScreen() {
  const navigation = useNavigation<RootNav>();
  const { colors } = useTheme();
  const { user, leaveGuestMode } = useSession();
  const userId = user?.id ?? null;

  const cardQuery = useQuery(userId ? `membership-card:${userId}` : null, () =>
    fetchMembershipCard(userId!),
  );
  const requestQuery = useQuery(
    userId ? `membership-request:${userId}` : null,
    () => fetchLatestMembershipRequest(userId!),
  );
  const { cache, cacheLoaded } = useCardCache(userId, cardQuery.data);

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
              onPress={leaveGuestMode}
            />
          }
        />
      </Screen>
    );
  }

  const validCache = cache && !isCacheExpired(cache) ? cache : null;
  const usingCache =
    cardQuery.data === undefined && !!validCache && cardQuery.error;
  const card: MembershipCard | null =
    cardQuery.data !== undefined ? cardQuery.data : validCache?.card ?? null;

  if (!card && (cardQuery.loading || !cacheLoaded)) {
    return (
      <Screen>
        <Skeleton height={380} radius={22} />
      </Screen>
    );
  }

  if (!card && cardQuery.error) {
    return (
      <Screen>
        <ErrorState
          title={
            cache
              ? 'Não foi possível confirmar seu status'
              : 'Não deu pra abrir sua carteirinha'
          }
          description={
            cache
              ? `Faz mais de ${CACHE_MAX_DAYS} dias sem sincronizar. Conecta na internet pra validar sua carteirinha de novo.`
              : 'Pode ser a conexão. Assim que voltar, ela aparece aqui — e fica salva no celular pra abrir sem internet.'
          }
          onRetry={() => cardQuery.reload()}
        />
      </Screen>
    );
  }

  if (!card) {
    const request = requestQuery.data;
    return (
      <Screen
        onRefresh={() =>
          Promise.all([cardQuery.reload(true), requestQuery.reload(true)])
        }
      >
        {request?.status === 'pending' ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Seu pedido está na fila"
            description={`A diretoria da ${
              request.association?.acronym ?? 'associação'
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
                onPress={() => navigation.navigate('MembershipRequest')}
              />
            }
          />
        )}
        {request?.status === 'rejected' ? (
          <Text variant="small" tone="muted">
            Seu último pedido não foi aprovado
            {request.note ? `: ${request.note}` : '.'} Você pode pedir de novo.
          </Text>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={() => cardQuery.reload(true)}>
      <MembershipCardView
        card={card}
        onReconnect={() => cardQuery.reload(true)}
      />
      {usingCache ? <OfflineNotice syncedAt={cache?.syncedAt} /> : null}
    </Screen>
  );
}
