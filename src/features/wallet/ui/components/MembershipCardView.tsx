import { Image, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Badge, type BadgeStatus, Text } from '../../../../shared/ui';
import { formatDate, hideCpf, vehicleLabel } from '../../../../shared/format';
import { alpha, palette, useTheme } from '../../../../shared/theme';
import { verificationUrl } from '../../data/walletRepository';
import { type MembershipCard, type StatusTone, statusSeal } from '../../domain';
import { useRotatingToken } from '../hooks/useRotatingToken';

const badgeByTone: Record<StatusTone, BadgeStatus> = {
  positive: 'ativo',
  warning: 'a-vencer',
  negative: 'inadimplente',
};

export function MembershipCardView({
  card,
  onReconnect,
}: {
  card: MembershipCard;
  onReconnect?: () => void;
}) {
  const { colors, radius } = useTheme();
  const { token, offline } = useRotatingToken(card.id, onReconnect);
  const seal = statusSeal(card.status);
  const association = card.association;
  const color = association?.primaryColor || palette.green;
  const holder = card.holder;

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius['2xl'],
          borderColor: alpha(color, 0.35),
          backgroundColor: colors.card,
        },
      ]}
    >
      <View style={[styles.header, { backgroundColor: color }]}>
        <View style={styles.association}>
          {association?.logoUrl ? (
            <Image
              source={{ uri: association.logoUrl }}
              accessibilityIgnoresInvertColors
              style={[styles.logo, { borderRadius: radius.md }]}
            />
          ) : (
            <View
              style={[
                styles.logo,
                styles.logoPlaceholder,
                { borderRadius: radius.md },
              ]}
            >
              <Text variant="title" style={styles.white}>
                {association?.acronym?.slice(0, 3) ?? 'ASS'}
              </Text>
            </View>
          )}
          <View style={styles.flex}>
            <Text variant="h3" style={styles.white} numberOfLines={1}>
              {association?.acronym ?? 'Associação'}
            </Text>
            <Text variant="caption" style={styles.softWhite} numberOfLines={1}>
              {association?.name ?? 'Carteirinha digital'}
            </Text>
          </View>
        </View>
        <Badge status={badgeByTone[seal.tone]} label={seal.label} />
      </View>

      <View style={styles.holder}>
        {holder?.photoUrl ? (
          <Image
            source={{ uri: holder.photoUrl }}
            accessibilityIgnoresInvertColors
            style={[styles.photo, { borderRadius: radius.md }]}
          />
        ) : (
          <View
            style={[
              styles.photo,
              styles.photoPlaceholder,
              { borderRadius: radius.md, backgroundColor: colors.muted },
            ]}
          >
            <Text variant="h1" tone="muted">
              {(holder?.name ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={2}>
            {holder?.name || 'Associado Sou Corre'}
          </Text>
          <Text variant="caption" tone="muted">
            CPF {hideCpf(holder?.cpf)}
          </Text>
          <Text variant="title" style={[styles.number, { color }]}>
            Nº {card.number}
          </Text>
        </View>
      </View>

      <View style={[styles.fields, { borderTopColor: colors.border }]}>
        <CardField
          label="Validade"
          value={formatDate(card.expiresAt) ?? 'Sem prazo'}
        />
        <CardField
          label="Veículo"
          value={vehicleLabel[holder?.vehicleType ?? ''] ?? '—'}
        />
        <CardField label="Placa" value={holder?.plate?.toUpperCase() || '—'} />
      </View>

      <View
        style={[
          styles.qrBox,
          { borderRadius: radius['2xl'], backgroundColor: palette.white },
        ]}
      >
        {token ? (
          <QRCode value={verificationUrl(token)} size={168} ecl="M" />
        ) : (
          <View style={[styles.qrPlaceholder, { borderRadius: radius.md }]}>
            <Text variant="caption" style={styles.qrText}>
              {offline
                ? 'Sem internet: o QR volta quando conectar. Os dados acima valem como identificação.'
                : 'Gerando seu código…'}
            </Text>
          </View>
        )}
        <Text variant="caption" style={styles.qrText}>
          Código novo a cada 60 segundos. Print de tela não vale.
        </Text>
      </View>
    </View>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.flex}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="title" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  white: { color: palette.white },
  softWhite: { color: alpha(palette.white, 0.8) },
  card: { borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  association: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 40, height: 40, backgroundColor: alpha(palette.white, 0.9) },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(palette.white, 0.2),
  },
  holder: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  photo: { width: 80, height: 80 },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  number: { marginTop: 4 },
  fields: {
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
  qrPlaceholder: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d5d8de',
    padding: 12,
  },
  qrText: { color: '#6b7280', textAlign: 'center', fontWeight: '500' },
});
