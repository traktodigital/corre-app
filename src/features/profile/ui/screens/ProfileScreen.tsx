import { Linking, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ClipboardCheck,
  History,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Siren,
  Trash2,
  User,
} from 'lucide-react-native';
import type { RootNav } from '../../../../app/navigation';
import { Screen } from '../../../../shared/layout';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconBox,
  ListSkeleton,
  Text,
  useDialog,
} from '../../../../shared/ui';
import {
  formatCurrency,
  formatDate,
  vehicleLabel,
} from '../../../../shared/format';
import { useQuery } from '../../../../shared/hooks/useQuery';
import { useTheme } from '../../../../shared/theme';
import { firstName, useSession } from '../../../auth';
import { ThreeBConsentAction } from '../../../accident';
import { clearCardCache } from '../../../wallet';
import { fetchSavings } from '../../../club';
import {
  deleteMyAccount,
  fetchProfile,
  privacyPolicyUrl,
} from '../../data/profileRepository';
import { DeveloperCredits } from '../components/DeveloperCredits';
import { ProfileAction } from '../components/ProfileAction';
import {
  ProfileDetails,
  type ProfileDetailRow,
} from '../components/ProfileDetails';

export function ProfileScreen() {
  const dialog = useDialog();
  const { colors } = useTheme();
  const navigation = useNavigation<RootNav>();
  const { user, signOut, leaveGuestMode, managedAssociationIds } = useSession();
  const userId = user?.id ?? null;

  const profileQuery = useQuery(userId ? `profile:${userId}` : null, () =>
    fetchProfile(userId!),
  );
  const savingsQuery = useQuery(userId ? `savings:${userId}` : null, () =>
    fetchSavings(userId!),
  );

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon={User}
          title="Crie sua conta primeiro"
          description="Entre pra ver seu perfil, sua carteirinha e seus descontos."
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

  async function handleSignOut() {
    await clearCardCache();
    await signOut();
  }

  async function deleteAccount() {
    try {
      await deleteMyAccount();
    } catch {
      dialog(
        'Não deu pra excluir',
        'Confira sua conexão e tente de novo. Se continuar, fale com o suporte.',
      );
      return;
    }
    await handleSignOut();
  }

  function confirmDeleteAccount() {
    dialog(
      'Excluir sua conta?',
      'Seus dados pessoais são apagados, a carteirinha é cancelada e você não consegue mais entrar com esta conta. Não dá pra desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: deleteAccount,
        },
      ],
    );
  }

  const profile = profileQuery.data;
  const rows = [
    ['E-mail', profile?.email ?? user.email],
    ['Telefone', profile?.phone],
    ['Cidade', [profile?.city, profile?.state].filter(Boolean).join(' / ')],
    [
      'Como roda',
      profile?.vehicleType ? vehicleLabel[profile.vehicleType] : undefined,
    ],
    ['Placa', profile?.plate],
    ['No Sou Corre desde', formatDate(profile?.createdAt)],
  ].filter(([, value]) => value) as ProfileDetailRow[];

  return (
    <Screen
      onRefresh={() =>
        Promise.all([profileQuery.reload(true), savingsQuery.reload(true)])
      }
    >
      <Card padding={20} style={styles.header}>
        <IconBox size={56}>
          <User size={28} color={colors.highlight} />
        </IconBox>
        <View style={styles.flex}>
          <Text variant="h2" numberOfLines={1}>
            {profile?.name || firstName(user)}
          </Text>
        </View>
      </Card>

      <Card padding={20}>
        <Text variant="small" tone="muted">
          Você já economizou
        </Text>
        <Text variant="hero" tone="highlight">
          {formatCurrency(savingsQuery.data?.total ?? 0)}
        </Text>
      </Card>

      {profileQuery.loading ? (
        <ListSkeleton rows={2} />
      ) : profileQuery.error && !profile ? (
        <ErrorState onRetry={() => profileQuery.reload()} />
      ) : (
        <ProfileDetails rows={rows} />
      )}

      <View style={styles.actions}>
        {managedAssociationIds.length > 0 ? (
          <ProfileAction
            icon={ClipboardCheck}
            label="Aprovar pedidos de filiação"
            onPress={() => navigation.navigate('MembershipRequestsAdmin')}
          />
        ) : null}
        <ProfileAction
          icon={Pencil}
          label="Editar meus dados"
          onPress={() => navigation.navigate('EditProfile')}
        />
        <ProfileAction
          icon={Siren}
          label="Contato de emergência"
          onPress={() => navigation.navigate('EmergencyContact')}
        />
        <ProfileAction
          icon={History}
          label="Histórico de resgates"
          onPress={() => navigation.navigate('RedemptionHistory')}
        />
        <ProfileAction
          icon={ShieldCheck}
          label="Política de privacidade"
          onPress={() => Linking.openURL(privacyPolicyUrl())}
        />
        <ThreeBConsentAction />
        <ProfileAction
          icon={Trash2}
          label="Excluir minha conta"
          onPress={confirmDeleteAccount}
        />
      </View>

      <Button
        variant="outline"
        size="lg"
        title="Sair da conta"
        icon={<LogOut size={16} color={colors.foreground} />}
        onPress={handleSignOut}
      />

      <DeveloperCredits />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1 },
  actions: { gap: 12 },
});
