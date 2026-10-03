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
  // ASSEMAG
  Filiacao: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Para telas dentro das abas, que não recebem `navigation` por props. */
export type RootNav = NativeStackNavigationProp<RootStackParamList>;
