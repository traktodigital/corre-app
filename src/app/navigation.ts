import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { AccidentReport } from '../features/accident';

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
  Refuel: { tripId: string };
  EndTrip: { tripId: string };
  TripSummary: { tripId: string };

  Emergency: undefined;
  EmergencyContact: undefined;

  Accident: undefined;
  AccidentForm: undefined;
  AccidentConsent: { report: AccidentReport };
  ThreeB: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
