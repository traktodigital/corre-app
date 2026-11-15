import {
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';

/**
 * GPS da jornada (ADR-0002 D1, ADR-0005 D1). Módulo nativo próprio, mesma API
 * nos dois sistemas:
 *   Android: android/app/src/main/java/br/com/trakto/corre/jornada/
 *   iOS:     ios/CorreApp/Jornada/ (+ Live Activity em ios/CorreJornadaWidget/)
 *
 * Só permissão "durante o uso": o rastreio nasce com o app aberto (botão
 * Iniciar jornada) e segue em segundo plano com notificação fixa (Android) /
 * indicador azul + Dynamic Island (iOS). Nunca pedimos "Sempre".
 */

export type Permissao = 'permitido' | 'negado' | 'bloqueado';

export type EstadoGps = {
  ativa: boolean;
  jornadaId: string;
  /** Km filtrados no aparelho (precisão ≤ 30 m, sem tremida, sem salto > 120 km/h). */
  km: number;
  pontos: number;
  /** Intervalos > 2 min sem ponto (app morto, túnel). Vários = km subestimado. */
  buracos: number;
  /** Algum ponto veio de app de localização falsa. Vai para `jornadas.suspeita`. */
  simulado: boolean;
  /** epoch ms (relógio do aparelho — o oficial é o do servidor). */
  iniciadaEm: number;
  /** CSV do trajeto (epochMs,lat,lng,precisaoM) para upload no Storage. */
  arquivo: string | null;
};

type Nativo = {
  pedirPermissao?: () => Promise<Permissao>; // só iOS
  iniciar: (jornadaId: string) => Promise<void>;
  estado: () => Promise<EstadoGps | null>;
  encerrar: () => Promise<EstadoGps | null>;
};

const nativo = NativeModules.JornadaGps as Nativo | undefined;

/** Pede só o necessário. Android 13+ também pede notificação (a do turno). */
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

/** 'bloqueado' só se resolve nos ajustes do sistema. */
export function abrirAjustes() {
  return Linking.openSettings();
}

/** Idempotente: chamar de novo com o mesmo id retoma a soma (app reaberto). */
export function iniciarGps(jornadaId: string) {
  if (!nativo) {
    return Promise.reject(new Error('GPS indisponível neste aparelho.'));
  }
  return nativo.iniciar(jornadaId);
}

export function estadoGps(): Promise<EstadoGps | null> {
  return nativo ? nativo.estado() : Promise.resolve(null);
}

/** Para o GPS e devolve km final + caminho do trajeto. */
export function encerrarGps(): Promise<EstadoGps | null> {
  return nativo ? nativo.encerrar() : Promise.resolve(null);
}
