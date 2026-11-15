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

  Partner: { id: string };
  Offer: { id: string };
  Redemption: { id: string };

  EditProfile: undefined;
  RedemptionHistory: undefined;
  MembershipRequestsAdmin: undefined;

  MembershipRequest: undefined;

  StartTrip: undefined;
  Refuel: { jornadaId: string };
  EndTrip: { jornadaId: string };
  TripSummary: { jornadaId: string };
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
