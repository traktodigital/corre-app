import {
  getLocationStatus,
  openSettings,
  requestCamera,
  requestLocation,
  requestNotifications,
} from '.';
import * as locationTracker from '../device/location';

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 34 },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
      CAMERA: 'android.permission.CAMERA',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
    request: jest.fn(),
    requestMultiple: jest.fn(),
    check: jest.fn(),
  },
  Linking: { openSettings: jest.fn() },
  NativeModules: {},
}));

type Mocked = {
  Platform: { OS: string; Version: number };
  PermissionsAndroid: {
    request: jest.Mock;
    requestMultiple: jest.Mock;
    check: jest.Mock;
  };
  Linking: { openSettings: jest.Mock };
  NativeModules: Record<string, unknown>;
};

const RN = jest.requireMock('react-native') as Mocked;
const FINE = 'android.permission.ACCESS_FINE_LOCATION';

function asAndroid(version = 34) {
  RN.Platform.OS = 'android';
  RN.Platform.Version = version;
}

function asIos(tracker?: Record<string, unknown>) {
  RN.Platform.OS = 'ios';
  RN.NativeModules.TripTracker = tracker;
}

beforeEach(() => {
  jest.clearAllMocks();
  delete RN.NativeModules.TripTracker;
  asAndroid();
});

describe('permissões: localização no Android', () => {
  test('concedida, negada e bloqueada', async () => {
    RN.PermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [FINE]: 'granted',
    });
    await expect(requestLocation()).resolves.toBe('granted');

    RN.PermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [FINE]: 'denied',
    });
    await expect(requestLocation()).resolves.toBe('denied');

    RN.PermissionsAndroid.requestMultiple.mockResolvedValueOnce({
      [FINE]: 'never_ask_again',
    });
    await expect(requestLocation()).resolves.toBe('blocked');
  });

  test('exceção vira indisponível, sem lançar', async () => {
    RN.PermissionsAndroid.requestMultiple.mockRejectedValueOnce(
      new Error('not attached to an Activity'),
    );
    await expect(requestLocation()).resolves.toBe('unavailable');

    RN.PermissionsAndroid.check.mockRejectedValueOnce(new Error('boom'));
    await expect(getLocationStatus()).resolves.toBe('unavailable');
  });

  test('status sem pedir', async () => {
    RN.PermissionsAndroid.check.mockResolvedValueOnce(true);
    await expect(getLocationStatus()).resolves.toBe('granted');
    RN.PermissionsAndroid.check.mockResolvedValueOnce(false);
    await expect(getLocationStatus()).resolves.toBe('denied');
  });
});

describe('permissões: notificação', () => {
  test('Android antes do 13 não precisa pedir', async () => {
    asAndroid(32);
    await expect(requestNotifications()).resolves.toBe('granted');
    expect(RN.PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  test('Android 13+ negada ou bloqueada não lança', async () => {
    RN.PermissionsAndroid.request.mockResolvedValueOnce('denied');
    await expect(requestNotifications()).resolves.toBe('denied');
    RN.PermissionsAndroid.request.mockResolvedValueOnce('never_ask_again');
    await expect(requestNotifications()).resolves.toBe('blocked');
    RN.PermissionsAndroid.request.mockRejectedValueOnce(new Error('boom'));
    await expect(requestNotifications()).resolves.toBe('unavailable');
  });

  test('iOS fica indisponível', async () => {
    asIos();
    await expect(requestNotifications()).resolves.toBe('unavailable');
  });
});

describe('permissões: câmera', () => {
  test('Android negada ou com erro não lança', async () => {
    RN.PermissionsAndroid.request.mockResolvedValueOnce('never_ask_again');
    await expect(requestCamera()).resolves.toBe('blocked');
    RN.PermissionsAndroid.request.mockRejectedValueOnce(new Error('boom'));
    await expect(requestCamera()).resolves.toBe('unavailable');
  });
});

describe('permissões: localização no iOS', () => {
  test('sem módulo nativo fica indisponível', async () => {
    asIos();
    await expect(requestLocation()).resolves.toBe('unavailable');
    await expect(getLocationStatus()).resolves.toBe('unavailable');
  });

  test('repassa o status do módulo nativo', async () => {
    asIos({
      start: jest.fn(),
      getState: jest.fn(),
      stop: jest.fn(),
      requestPermission: jest.fn().mockResolvedValue('blocked'),
      getPermissionStatus: jest.fn().mockResolvedValue('granted'),
    });
    await expect(requestLocation()).resolves.toBe('blocked');
    await expect(getLocationStatus()).resolves.toBe('granted');
  });

  test('valor desconhecido ou exceção no nativo vira indisponível', async () => {
    asIos({
      start: jest.fn(),
      getState: jest.fn(),
      stop: jest.fn(),
      requestPermission: jest.fn().mockResolvedValue('permitido'),
      getPermissionStatus: jest.fn().mockRejectedValue(new Error('boom')),
    });
    await expect(requestLocation()).resolves.toBe('unavailable');
    await expect(getLocationStatus()).resolves.toBe('unavailable');
  });
});

describe('permissões: ajustes', () => {
  test('abrir ajustes nunca lança', async () => {
    RN.Linking.openSettings.mockResolvedValueOnce(undefined);
    await expect(openSettings()).resolves.toBe(true);
    RN.Linking.openSettings.mockRejectedValueOnce(new Error('boom'));
    await expect(openSettings()).resolves.toBe(false);
  });
});

describe('rastreio: módulo nativo', () => {
  test('sem módulo nativo: indisponível e sem estado', async () => {
    expect(locationTracker.isAvailable()).toBe(false);
    await expect(locationTracker.start('t1')).resolves.toBe('unavailable');
    await expect(locationTracker.getState()).resolves.toBeNull();
    await expect(locationTracker.stop()).resolves.toBeNull();
  });

  test('erros do nativo viram resultado tipado', async () => {
    const start = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), { code: 'permission_denied' }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), { code: 'foreground_not_allowed' }),
      )
      .mockResolvedValueOnce(undefined);
    RN.NativeModules.TripTracker = {
      start,
      getState: jest.fn().mockRejectedValue(new Error('boom')),
      stop: jest.fn().mockResolvedValue({
        active: true,
        tripId: 't1',
        km: 12.5,
        points: 30,
        gaps: 1,
        mocked: false,
        startedAt: 1000,
        file: '/data/jornada-t1.csv',
      }),
    };
    await expect(locationTracker.start('t1')).resolves.toBe('denied');
    await expect(locationTracker.start('t1')).resolves.toBe('failed');
    await expect(locationTracker.start('t1')).resolves.toBe('started');
    await expect(locationTracker.getState()).resolves.toBeNull();
    await expect(locationTracker.stop()).resolves.toEqual({
      active: true,
      tripId: 't1',
      km: 12.5,
      points: 30,
      gaps: 1,
      mocked: false,
      startedAt: 1000,
      file: '/data/jornada-t1.csv',
    });
  });
});
