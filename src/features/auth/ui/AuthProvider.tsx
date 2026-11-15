import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as authRepository from '../data/authRepository';
import { passwordResetEmailError } from '../domain/authErrors';
import {
  type AuthResult,
  NO_ACCESS,
  type Role,
  type SignUpInput,
  type SignUpResult,
  type UserAccess,
} from '../domain/types';

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

export type AuthActions = {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
};

const SessionContext = createContext<SessionState | null>(null);
const AuthActionsContext = createContext<AuthActions | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<UserAccess>(NO_ACCESS);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    let active = true;

    authRepository
      .getSession()
      .then(async current => {
        if (!active) {
          return;
        }
        setSession(current);
        if (current) {
          setAccess(await authRepository.loadUserAccess(current.user.id));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const unsubscribe = authRepository.subscribeToSession(next => {
      setSession(next);
      if (next) {
        setIsGuest(false);

        setTimeout(() => {
          authRepository.loadUserAccess(next.user.id).then(loaded => {
            if (active) {
              setAccess(loaded);
            }
          });
        }, 0);
      } else {
        setAccess(NO_ACCESS);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authRepository.signIn(email, password);
    if (result.access) {
      setAccess(result.access);
    }
    return { error: result.error };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const result = await authRepository.signUp(input);
    if (result.access) {
      setAccess(result.access);
    }
    return { error: result.error, needsConfirmation: result.needsConfirmation };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const invalid = passwordResetEmailError(email);
    if (invalid) {
      return { error: invalid };
    }
    return authRepository.sendPasswordReset(email);
  }, []);

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    setIsGuest(false);
  }, []);

  const exploreAsGuest = useCallback(() => setIsGuest(true), []);
  const leaveGuestMode = useCallback(() => setIsGuest(false), []);

  const sessionState = useMemo<SessionState>(
    () => ({
      session,
      user: session?.user ?? null,
      roles: access.roles,
      managedAssociationIds: access.managedAssociationIds,
      loading,
      isGuest,
      exploreAsGuest,
      leaveGuestMode,
      signOut,
      hasRole: (role: Role) => access.roles.includes(role),
    }),
    [
      session,
      access,
      loading,
      isGuest,
      exploreAsGuest,
      leaveGuestMode,
      signOut,
    ],
  );

  const actions = useMemo<AuthActions>(
    () => ({ signIn, signUp, requestPasswordReset }),
    [signIn, signUp, requestPasswordReset],
  );

  return (
    <AuthActionsContext.Provider value={actions}>
      <SessionContext.Provider value={sessionState}>
        {children}
      </SessionContext.Provider>
    </AuthActionsContext.Provider>
  );
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession precisa estar dentro de <AuthProvider>');
  }
  return context;
}

export function useAuthActions(): AuthActions {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions precisa estar dentro de <AuthProvider>');
  }
  return context;
}
