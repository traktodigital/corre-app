import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ConfirmEmail: { email: string };
  Main: undefined;
  // Clube de benefícios
  Parceiro: { id: string };
  Oferta: { id: string };
  Resgate: { id: string };
  // Área do usuário
  EditarPerfil: undefined;
  Historico: undefined;
  FiliacoesAdmin: undefined;
  // ASSEMAG
  Filiacao: undefined;
  // Jornada do dia (ADR-0005)
  IniciarJornada: undefined;
  Abastecimento: { jornadaId: string };
  EncerrarJornada: { jornadaId: string };
  ResumoJornada: { jornadaId: string };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Para telas dentro das abas, que não recebem `navigation` por props. */
export type RootNav = NativeStackNavigationProp<RootStackParamList>;
