import { StyleSheet, View } from 'react-native';
import { UserRoundCheck } from 'lucide-react-native';
import { Button, Card, Input, Text } from '../../../../shared/ui';
import {
  formatDateTime,
  maskCpf,
  vehicleLabel,
} from '../../../../shared/format';
import { useTheme } from '../../../../shared/theme';
import type { PendingMembershipRequest } from '../../domain';

export function PendingRequestCard({
  request,
  busy,
  saving,
  rejecting,
  note,
  onApprove,
  onStartRejection,
  onCancelRejection,
  onNoteChange,
  onReject,
}: {
  request: PendingMembershipRequest;
  busy: boolean;
  saving: boolean;
  rejecting: boolean;
  note: string;
  onApprove: () => void;
  onStartRejection: () => void;
  onCancelRejection: () => void;
  onNoteChange: (value: string) => void;
  onReject: () => void;
}) {
  const { colors } = useTheme();
  const vehicle = request.vehicleType
    ? vehicleLabel[request.vehicleType] ?? request.vehicleType
    : null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="h3">{request.name}</Text>
          <Text variant="caption" tone="muted">
            Pedido em {formatDateTime(request.createdAt) ?? 'data indisponível'}
          </Text>
        </View>
        <UserRoundCheck size={20} color={colors.highlight} />
      </View>

      <View style={styles.fields}>
        <InfoRow
          label="CPF"
          value={request.cpf ? maskCpf(request.cpf) : null}
        />
        <InfoRow label="Telefone" value={request.phone} />
        <InfoRow
          label="Cidade"
          value={[request.city, request.state].filter(Boolean).join(' / ')}
        />
        <InfoRow label="Veículo" value={vehicle} />
        <InfoRow label="Placa" value={request.plate} />
      </View>

      {rejecting ? (
        <View style={styles.rejectionForm}>
          <Input
            label="Motivo da recusa"
            value={note}
            onChangeText={onNoteChange}
            multiline
            maxLength={500}
            textAlignVertical="top"
            style={styles.textarea}
          />
          <View style={styles.actions}>
            <Button
              variant="outline"
              title="Cancelar"
              disabled={busy}
              onPress={onCancelRejection}
            />
            <Button
              variant="destructive"
              title={saving ? 'Recusando...' : 'Confirmar recusa'}
              loading={saving}
              disabled={busy}
              onPress={onReject}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            variant="outline"
            title="Recusar"
            disabled={busy}
            onPress={onStartRejection}
          />
          <Button
            title={saving ? 'Aprovando...' : 'Aprovar filiação'}
            loading={saving}
            disabled={busy}
            onPress={onApprove}
          />
        </View>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="small" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  fields: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  value: { flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  rejectionForm: { gap: 12 },
  textarea: { height: 96, paddingTop: 12 },
});
