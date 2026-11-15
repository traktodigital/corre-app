import {
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';

export type Permissao = 'permitido' | 'negado' | 'bloqueado';

export type EstadoGps = {
  ativa: boolean;
  jornadaId: string;

  km: number;
  pontos: number;

  buracos: number;

  simulado: boolean;

  iniciadaEm: number;

  arquivo: string | null;
};

type Nativo = {
  pedirPermissao?: () => Promise<Permissao>;
  iniciar: (jornadaId: string) => Promise<void>;
  estado: () => Promise<EstadoGps | null>;
  encerrar: () => Promise<EstadoGps | null>;
};

const nativo = NativeModules.JornadaGps as Nativo | undefined;

export async function pedirPermissaoGps(): Promise<Permissao> {
  if (!nativo) {
    return 'negado';
  }
  if (Platform.OS === 'ios') {
    return nativo.pedirPermissao!();
  }
  const P = PermissionsAndroid.PERMISSIONS;
  const pedidos: Permission[] = [
    P.ACCESS_FINE_LOCATION,
    P.ACCESS_COARSE_LOCATION,
  ];
  if (Number(Platform.Version) >= 33) {
    pedidos.push(P.POST_NOTIFICATIONS);
  }
  const r = await PermissionsAndroid.requestMultiple(pedidos);
  const loc = r[P.ACCESS_FINE_LOCATION];
  if (loc === PermissionsAndroid.RESULTS.GRANTED) {
    return 'permitido';
  }
  return loc === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ? 'bloqueado'
    : 'negado';
}

export function abrirAjustes() {
  return Linking.openSettings();
}

export function iniciarGps(jornadaId: string) {
  if (!nativo) {
    return Promise.reject(new Error('GPS indisponível neste aparelho.'));
  }
  return nativo.iniciar(jornadaId);
}

export function estadoGps(): Promise<EstadoGps | null> {
  return nativo ? nativo.estado() : Promise.resolve(null);
}

export function encerrarGps(): Promise<EstadoGps | null> {
  return nativo ? nativo.encerrar() : Promise.resolve(null);
}
