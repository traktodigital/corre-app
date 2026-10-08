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
import {
  createNativeStackNavigator,
  NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { AppShell, IntroSplash, TabKey } from '../components/layout';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { ConfirmEmailScreen } from '../features/auth/ConfirmEmailScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SignupScreen } from '../features/auth/SignupScreen';
import { WelcomeScreen } from '../features/auth/WelcomeScreen';
import { FiliacaoScreen } from '../features/carteira/FiliacaoScreen';
import { CarteiraScreen } from '../features/carteira/screen';
import { FiliacoesAdminScreen } from '../features/admin/FiliacoesAdminScreen';
import { BeneficiosScreen } from '../features/clube/BeneficiosScreen';
import { OfertaScreen } from '../features/clube/OfertaScreen';
import { ParceiroScreen } from '../features/clube/ParceiroScreen';
import { ResgateScreen } from '../features/clube/ResgateScreen';
import { HomeScreen } from '../features/home/screen';
import { EditarPerfilScreen } from '../features/profile/EditarPerfilScreen';
import { HistoricoScreen } from '../features/profile/HistoricoScreen';
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

/** Telas empilhadas por cima das abas: header nativo com "voltar". */
const comHeader = (title: string): NativeStackNavigationOptions => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: darkColors.background },
  headerTintColor: darkColors.foreground,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
});

function MainTabs() {
  const [tab, setTab] = useState<TabKey>('inicio');
  return (
    <AppShell activeTab={tab} onChangeTab={setTab}>
      {tab === 'inicio' ? (
        <HomeScreen onIrPara={setTab} />
      ) : tab === 'beneficios' ? (
        <BeneficiosScreen />
      ) : tab === 'carteira' ? (
        <CarteiraScreen />
      ) : (
        <ProfileScreen />
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
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Parceiro"
            component={ParceiroScreen}
            options={comHeader('Parceiro')}
          />
          <Stack.Screen
            name="Oferta"
            component={OfertaScreen}
            options={comHeader('Oferta')}
          />
          <Stack.Screen
            name="Resgate"
            component={ResgateScreen}
            options={comHeader('Seu código')}
          />
          <Stack.Screen
            name="Filiacao"
            component={FiliacaoScreen}
            options={comHeader('Filiação')}
          />
          <Stack.Screen
            name="EditarPerfil"
            component={EditarPerfilScreen}
            options={comHeader('Meus dados')}
          />
          <Stack.Screen
            name="Historico"
            component={HistoricoScreen}
            options={comHeader('Histórico')}
          />
          <Stack.Screen
            name="FiliacoesAdmin"
            component={FiliacoesAdminScreen}
            options={comHeader('Pedidos de filiação')}
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
