import type { Session, User } from '@supabase/supabase-js';
import { type Papel, type TipoVeiculo, useAuth } from './AuthProvider';

export { AuthProvider, primeiroNome as firstName } from './AuthProvider';
export { ConfirmEmailScreen } from './ConfirmEmailScreen';
export { LoginScreen } from './LoginScreen';
export { SignupScreen } from './SignupScreen';
export { WelcomeScreen } from './WelcomeScreen';
export {
  telefoneValido as isValidPhone,
  mascararTelefone as maskPhone,
} from './telefone';

export type VehicleType = TipoVeiculo;
export type Role = Papel;

export type SessionState = {
  session: Session | null;
  user: User | null;
  roles: Role[];
  managedAssociationIds: string[];
  loading: boolean;
  isGuest: boolean;
  exploreAsGuest: () => void;
  leaveGuestMode: () => void;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
};

export function useSession(): SessionState {
  const auth = useAuth();
  return {
    session: auth.session,
    user: auth.user,
    roles: auth.papeis,
    managedAssociationIds: auth.associacoesAdministradas,
    loading: auth.carregando,
    isGuest: auth.visitante,
    exploreAsGuest: auth.explorarSemCadastro,
    leaveGuestMode: auth.sairDoModoVisitante,
    signOut: auth.sair,
    hasRole: auth.temPapel,
  };
}
