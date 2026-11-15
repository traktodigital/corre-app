import { NativeModules } from 'react-native';

export type NativeTrackerState = {
  active?: unknown;
  tripId?: unknown;
  km?: unknown;
  points?: unknown;
  gaps?: unknown;
  mocked?: unknown;
  startedAt?: unknown;
  file?: unknown;
};

export type TripTrackerNativeModule = {
  requestPermission?: () => Promise<unknown>;
  getPermissionStatus?: () => Promise<unknown>;
  start: (tripId: string) => Promise<void>;
  getState: () => Promise<NativeTrackerState | null>;
  stop: () => Promise<NativeTrackerState | null>;
};

export function getTripTrackerModule(): TripTrackerNativeModule | null {
  try {
    const native = NativeModules.TripTracker as
      | Partial<TripTrackerNativeModule>
      | undefined;
    if (
      native &&
      typeof native.start === 'function' &&
      typeof native.getState === 'function' &&
      typeof native.stop === 'function'
    ) {
      return native as TripTrackerNativeModule;
    }
    return null;
  } catch {
    return null;
  }
}
