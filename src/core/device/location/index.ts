import { getTripTrackerModule, type NativeTrackerState } from './nativeModule';

export type TrackerState = {
  active: boolean;
  tripId: string;
  km: number;
  points: number;
  gaps: number;
  mocked: boolean;
  startedAt: number;
  file: string | null;
};

export type StartResult = 'started' | 'denied' | 'unavailable' | 'failed';

const PERMISSION_DENIED = 'permission_denied';

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toTrackerState(
  raw: NativeTrackerState | null | undefined,
): TrackerState | null {
  if (!raw || typeof raw.tripId !== 'string') {
    return null;
  }
  return {
    active: raw.active !== false,
    tripId: raw.tripId,
    km: numberOr(raw.km, 0),
    points: numberOr(raw.points, 0),
    gaps: numberOr(raw.gaps, 0),
    mocked: raw.mocked === true,
    startedAt: numberOr(raw.startedAt, 0),
    file: typeof raw.file === 'string' && raw.file ? raw.file : null,
  };
}

function errorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function isAvailable(): boolean {
  return getTripTrackerModule() !== null;
}

export async function start(tripId: string): Promise<StartResult> {
  const native = getTripTrackerModule();
  if (!native) {
    return 'unavailable';
  }
  try {
    await native.start(tripId);
    return 'started';
  } catch (error) {
    return errorCode(error) === PERMISSION_DENIED ? 'denied' : 'failed';
  }
}

export async function getState(): Promise<TrackerState | null> {
  const native = getTripTrackerModule();
  if (!native) {
    return null;
  }
  try {
    return toTrackerState(await native.getState());
  } catch {
    return null;
  }
}

export async function stop(): Promise<TrackerState | null> {
  const native = getTripTrackerModule();
  if (!native) {
    return null;
  }
  try {
    return toTrackerState(await native.stop());
  } catch {
    return null;
  }
}

export type LastLocation = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export async function getLastLocation(): Promise<LastLocation | null> {
  const native = getTripTrackerModule();
  if (!native?.getLastLocation) {
    return null;
  }
  try {
    const raw = (await native.getLastLocation()) as Record<
      string,
      unknown
    > | null;
    if (!raw || typeof raw.lat !== 'number' || typeof raw.lng !== 'number') {
      return null;
    }
    const accuracy =
      typeof raw.accuracy === 'number' && raw.accuracy >= 0
        ? raw.accuracy
        : null;
    return { lat: raw.lat, lng: raw.lng, accuracy };
  } catch {
    return null;
  }
}
