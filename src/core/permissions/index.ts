import {
  Linking,
  PermissionsAndroid,
  Platform,
  type Permission,
} from 'react-native';
import { getTripTrackerModule } from '../device/location/nativeModule';

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'unavailable';

const STATUSES: readonly PermissionStatus[] = [
  'granted',
  'denied',
  'blocked',
  'unavailable',
];

const ANDROID_NOTIFICATIONS_API = 33;

function fromNative(value: unknown): PermissionStatus {
  return STATUSES.includes(value as PermissionStatus)
    ? (value as PermissionStatus)
    : 'unavailable';
}

function fromAndroid(result: string | undefined): PermissionStatus {
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return 'blocked';
  }
  return 'denied';
}

function androidApiLevel(): number {
  const level = Number(Platform.Version);
  return Number.isFinite(level) ? level : 0;
}

async function requestAndroid(
  permission: Permission | undefined,
): Promise<PermissionStatus> {
  if (!permission) {
    return 'unavailable';
  }
  return fromAndroid(await PermissionsAndroid.request(permission));
}

export async function requestLocation(): Promise<PermissionStatus> {
  try {
    if (Platform.OS === 'android') {
      const { ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION } =
        PermissionsAndroid.PERMISSIONS;
      const results = await PermissionsAndroid.requestMultiple([
        ACCESS_FINE_LOCATION,
        ACCESS_COARSE_LOCATION,
      ]);
      return fromAndroid(results?.[ACCESS_FINE_LOCATION]);
    }
    if (Platform.OS === 'ios') {
      const native = getTripTrackerModule();
      if (!native?.requestPermission) {
        return 'unavailable';
      }
      return fromNative(await native.requestPermission());
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function getLocationStatus(): Promise<PermissionStatus> {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted ? 'granted' : 'denied';
    }
    if (Platform.OS === 'ios') {
      const native = getTripTrackerModule();
      if (!native?.getPermissionStatus) {
        return 'unavailable';
      }
      return fromNative(await native.getPermissionStatus());
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestNotifications(): Promise<PermissionStatus> {
  try {
    if (Platform.OS !== 'android') {
      return 'unavailable';
    }
    if (androidApiLevel() < ANDROID_NOTIFICATIONS_API) {
      return 'granted';
    }
    return await requestAndroid(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    return 'unavailable';
  }
}

export async function requestCamera(): Promise<PermissionStatus> {
  try {
    if (Platform.OS !== 'android') {
      return 'unavailable';
    }
    return await requestAndroid(PermissionsAndroid.PERMISSIONS.CAMERA);
  } catch {
    return 'unavailable';
  }
}

export async function openSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}
