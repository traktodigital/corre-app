/**
 * @format
 */

import { useCallback, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DarkTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Construction } from 'lucide-react-native';
import {
  AppShell,
  IntroSplash,
  Screen,
  TabKey,
  tabs,
} from '../components/layout';
import { EmptyState } from '../components/ui';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { ConfirmEmailScreen } from '../features/auth/ConfirmEmailScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SignupScreen } from '../features/auth/SignupScreen';
import { WelcomeScreen } from '../features/auth/WelcomeScreen';
import { HomeScreen } from '../features/home/screen';
import { ProfileScreen } from '../features/profile/screen';
import { darkColors, ThemeProvider } from '../theme';
import type { RootStackParamList } from './navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

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

function EmBreve({ tab }: { tab: TabKey }) {
  const label = tabs.find(t => t.key === tab)?.label ?? '';
  return (
    <Screen>
      <EmptyState
        icon={Construction}
        title={`${label} em breve`}
        description="Essa tela chega junto com a integração do backend."
      />
    </Screen>
  );
}

function MainTabs() {
  const [tab, setTab] = useState<TabKey>('inicio');
  return (
    <AppShell activeTab={tab} onChangeTab={setTab}>
      {tab === 'inicio' ? (
        <HomeScreen />
      ) : tab === 'perfil' ? (
        <ProfileScreen />
      ) : (
        <EmBreve tab={tab} />
      )}
    </AppShell>
  );
}

function RootNavigator() {
  const { session, visitante } = useAuth();
  const dentro = !!session || visitante;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: darkColors.background },
      }}
    >
      {dentro ? (
        <Stack.Screen name="Main" component={MainTabs} />
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
  const { carregando } = useAuth();
  const [introAcabou, setIntroAcabou] = useState(false);
  const hideIntro = useCallback(() => setIntroAcabou(true), []);

  return (
    <>
      {/* Só monta a navegação depois de saber se já existe sessão salva. */}
      {carregando ? null : (
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      )}
      {introAcabou ? null : <IntroSplash onFinish={hideIntro} />}
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider mode="dark">
        <AuthProvider>
          <StatusBar barStyle="light-content" />
          <Root />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
