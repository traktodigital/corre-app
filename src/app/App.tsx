import { useCallback, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  createNavigationContainerRef,
  DarkTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { AppShell, IntroSplash, TabKey } from '../shared/layout';
import {
  AccidentConsentScreen,
  AccidentFormScreen,
  AccidentScreen,
  ThreeBScreen,
} from '../features/accident';
import { MembershipRequestsAdminScreen } from '../features/admin';
import {
  AuthProvider,
  ConfirmEmailScreen,
  LoginScreen,
  SignupScreen,
  useSession,
  WelcomeScreen,
} from '../features/auth';
import {
  BenefitsScreen,
  OfferScreen,
  PartnerScreen,
  RedemptionHistoryScreen,
  RedemptionScreen,
} from '../features/club';
import {
  EmergencyButton,
  EmergencyContactScreen,
  EmergencyScreen,
} from '../features/emergency';
import { HomeScreen } from '../features/home';
import { EditProfileScreen, ProfileScreen } from '../features/profile';
import {
  EndTripScreen,
  RefuelScreen,
  StartTripScreen,
  TripScreen,
  TripSummaryScreen,
} from '../features/trip';
import { MembershipRequestScreen, WalletScreen } from '../features/wallet';
import { darkColors, ThemeProvider } from '../shared/theme';
import { DialogProvider } from '../shared/ui';
import type { RootStackParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const navTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.card,
    text: darkColors.foreground,
    border: darkColors.border,
    notification: darkColors.highlight,
  },
};

const comHeader = (title: string): NativeStackNavigationOptions => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: darkColors.background },
  headerTintColor: darkColors.foreground,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
});

function MainTabs() {
  const [tab, setTab] = useState<TabKey>('trip');
  return (
    <AppShell activeTab={tab} onChangeTab={setTab}>
      {tab === 'trip' ? (
        <TripScreen />
      ) : tab === 'home' ? (
        <HomeScreen onSelectTab={setTab} />
      ) : tab === 'benefits' ? (
        <BenefitsScreen />
      ) : tab === 'wallet' ? (
        <WalletScreen />
      ) : (
        <ProfileScreen />
      )}
    </AppShell>
  );
}

function RootNavigator() {
  const { session, isGuest } = useSession();
  const dentro = !!session || isGuest;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: darkColors.background },
      }}
    >
      {dentro ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Partner"
            component={PartnerScreen}
            options={comHeader('Parceiro')}
          />
          <Stack.Screen
            name="Offer"
            component={OfferScreen}
            options={comHeader('Oferta')}
          />
          <Stack.Screen
            name="Redemption"
            component={RedemptionScreen}
            options={comHeader('Seu código')}
          />
          <Stack.Screen
            name="MembershipRequest"
            component={MembershipRequestScreen}
            options={comHeader('Filiação')}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={comHeader('Meus dados')}
          />
          <Stack.Screen
            name="RedemptionHistory"
            component={RedemptionHistoryScreen}
            options={comHeader('Histórico')}
          />
          <Stack.Screen
            name="MembershipRequestsAdmin"
            component={MembershipRequestsAdminScreen}
            options={comHeader('Pedidos de filiação')}
          />
          <Stack.Screen
            name="StartTrip"
            component={StartTripScreen}
            options={comHeader('Iniciar jornada')}
          />
          <Stack.Screen
            name="Refuel"
            component={RefuelScreen}
            options={comHeader('Abastecimento')}
          />
          <Stack.Screen
            name="EndTrip"
            component={EndTripScreen}
            options={comHeader('Encerrar jornada')}
          />
          <Stack.Screen
            name="TripSummary"
            component={TripSummaryScreen}
            options={comHeader('Resumo do dia')}
          />
          <Stack.Screen
            name="Emergency"
            component={EmergencyScreen}
            options={comHeader('Emergência')}
          />
          <Stack.Screen
            name="EmergencyContact"
            component={EmergencyContactScreen}
            options={comHeader('Contato de emergência')}
          />
          <Stack.Screen
            name="Accident"
            component={AccidentScreen}
            options={comHeader('Sofri acidente')}
          />
          <Stack.Screen
            name="AccidentForm"
            component={AccidentFormScreen}
            options={comHeader('Saber meus direitos')}
          />
          <Stack.Screen
            name="AccidentConsent"
            component={AccidentConsentScreen}
            options={comHeader('Análise gratuita')}
          />
          <Stack.Screen
            name="ThreeB"
            component={ThreeBScreen}
            options={comHeader('3B Indenizações')}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function Root() {
  const { loading, session, isGuest } = useSession();
  const [introAcabou, setIntroAcabou] = useState(false);
  const hideIntro = useCallback(() => setIntroAcabou(true), []);
  const [routeName, setRouteName] = useState<string>();
  const syncRoute = useCallback(
    () => setRouteName(navigationRef.getCurrentRoute()?.name),
    [],
  );
  const openEmergency = useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Emergency');
    }
  }, []);

  return (
    <>
      {loading ? null : (
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          onReady={syncRoute}
          onStateChange={syncRoute}
        >
          <RootNavigator />
        </NavigationContainer>
      )}
      {!loading && (session || isGuest) ? (
        <EmergencyButton routeName={routeName} onTrigger={openEmergency} />
      ) : null}
      {introAcabou ? null : <IntroSplash onFinish={hideIntro} />}
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider mode="dark">
        <DialogProvider>
          <AuthProvider>
            <StatusBar barStyle="light-content" />
            <Root />
          </AuthProvider>
        </DialogProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
