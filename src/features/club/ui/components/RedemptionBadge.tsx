import { Badge, type BadgeStatus } from '../../../../shared/ui';
import { redemptionStatusLabel, type RedemptionStatus } from '../../domain';

const badgeStatus: Record<RedemptionStatus, BadgeStatus> = {
  generated: 'a-vencer',
  validated: 'ativo',
  expired: 'inadimplente',
  cancelled: 'inadimplente',
};

export function RedemptionBadge({ status }: { status: RedemptionStatus }) {
  return (
    <Badge status={badgeStatus[status]} label={redemptionStatusLabel[status]} />
  );
}
