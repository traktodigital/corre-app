import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import type { ScreenProps } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Chip,
  EmptyState,
  ErrorState,
  InlineError,
  ListSkeleton,
  Text,
  useDialog,
} from '../../../../shared/ui';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useSession } from '../../../auth';
import {
  approveMembershipRequest,
  fetchManagedAssociations,
  fetchPendingRequests,
  rejectMembershipRequest,
} from '../../data/adminRepository';
import {
  errorMessage,
  parseReviewError,
  type PendingMembershipRequest,
  validateRejectionNote,
} from '../../domain';
import { PendingRequestCard } from '../components/PendingRequestCard';

export function MembershipRequestsAdminScreen({}: ScreenProps<'MembershipRequestsAdmin'>) {
  const dialog = useDialog();
  const { user, managedAssociationIds } = useSession();
  const [associationId, setAssociationId] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const associationsQuery = useQuery(
    user && managedAssociationIds.length > 0
      ? `managed-associations:${user.id}`
      : null,
    () => fetchManagedAssociations(managedAssociationIds),
  );
  const associations = useMemo(
    () => associationsQuery.data ?? [],
    [associationsQuery.data],
  );
  const selectedId = useMemo(() => {
    if (associations.some(a => a.id === associationId)) {
      return associationId;
    }
    return associations[0]?.id ?? '';
  }, [associationId, associations]);
  const requestsQuery = useQuery(
    selectedId ? `pending-requests:${selectedId}` : null,
    () => fetchPendingRequests(selectedId),
  );

  async function handleFailure(e: unknown) {
    const { reason, reload } = parseReviewError(errorMessage(e));
    setActionError(reason);
    if (reload) {
      setRejectingId(null);
      setNote('');
      await requestsQuery.reload(true);
    }
  }

  async function approve(request: PendingMembershipRequest) {
    setActionError(null);
    setActingId(request.id);
    try {
      await approveMembershipRequest(request.id);
      await requestsQuery.reload(true);
    } catch (e) {
      await handleFailure(e);
    } finally {
      setActingId(null);
    }
  }

  function confirmApproval(request: PendingMembershipRequest) {
    dialog(
      'Aprovar filiação?',
      `A aprovação cria o vínculo de ${request.name} com a associação e libera a carteirinha digital.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: () => {
            approve(request);
          },
        },
      ],
    );
  }

  async function reject(request: PendingMembershipRequest) {
    const invalid = validateRejectionNote(note);
    if (invalid) {
      setActionError(invalid);
      return;
    }
    setActionError(null);
    setActingId(request.id);
    try {
      await rejectMembershipRequest(request.id, note);
      setRejectingId(null);
      setNote('');
      await requestsQuery.reload(true);
    } catch (e) {
      await handleFailure(e);
    } finally {
      setActingId(null);
    }
  }

  if (!user || managedAssociationIds.length === 0) {
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

  if (associationsQuery.loading) {
    return (
      <Screen>
        <ListSkeleton rows={2} />
      </Screen>
    );
  }

  if (associationsQuery.error && !associationsQuery.data) {
    return (
      <Screen>
        <ErrorState onRetry={() => associationsQuery.reload()} />
      </Screen>
    );
  }

  if (associations.length === 0) {
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

  const requests = requestsQuery.data ?? [];

  return (
    <Screen
      onRefresh={() =>
        Promise.all([
          associationsQuery.reload(true),
          requestsQuery.reload(true),
        ])
      }
    >
      <View>
        <Text variant="h1">Pedidos de filiação</Text>
        <Text variant="small" tone="muted">
          Confira os dados e aprove ou recuse cada pedido.
        </Text>
      </View>

      {associations.length > 1 ? (
        <View style={styles.group}>
          <Text variant="small" style={styles.strong}>
            Associação
          </Text>
          <View style={styles.chips}>
            {associations.map(a => (
              <Chip
                key={a.id}
                label={a.acronym}
                selected={selectedId === a.id}
                onPress={() => setAssociationId(a.id)}
              />
            ))}
          </View>
        </View>
      ) : (
        <Text variant="small" tone="highlight" style={styles.strong}>
          {associations[0].acronym} — {associations[0].name}
        </Text>
      )}

      {actionError ? <InlineError text={actionError} /> : null}

      {requestsQuery.loading ? (
        <ListSkeleton rows={3} />
      ) : requestsQuery.error && !requestsQuery.data ? (
        <ErrorState onRetry={() => requestsQuery.reload()} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nenhum pedido pendente"
          description="Quando alguém pedir para se filiar, o pedido vai aparecer aqui."
        />
      ) : (
        <View style={styles.list}>
          {requests.map(request => (
            <PendingRequestCard
              key={request.id}
              request={request}
              busy={actingId !== null}
              saving={actingId === request.id}
              rejecting={rejectingId === request.id}
              note={rejectingId === request.id ? note : ''}
              onApprove={() => confirmApproval(request)}
              onStartRejection={() => {
                setActionError(null);
                setRejectingId(request.id);
                setNote('');
              }}
              onCancelRejection={() => {
                setRejectingId(null);
                setNote('');
              }}
              onNoteChange={setNote}
              onReject={() => reject(request)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  strong: { fontWeight: '700' },
  list: { gap: 12 },
});
