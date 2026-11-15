import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as locationTracker from '../../../core/device/location';
import {
  getLocationStatus,
  requestLocation,
  requestNotifications,
  type PermissionStatus,
} from '../../../core/permissions';
import { useQuery } from '../../../shared/hooks/useQuery';
import { tripQueryKeys } from './queryKeys';

export type TrackingIssue = 'stopped' | 'denied' | 'blocked' | 'unavailable';

const TRACKER_POLL_MS = 5000;

async function issueFromStart(
  result: locationTracker.StartResult,
): Promise<TrackingIssue | null> {
  switch (result) {
    case 'started':
      return null;
    case 'denied':
      return (await getLocationStatus()) === 'blocked' ? 'blocked' : 'denied';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'stopped';
  }
}

function issueFromPermission(status: PermissionStatus): TrackingIssue | null {
  switch (status) {
    case 'granted':
      return null;
    case 'blocked':
      return 'blocked';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'denied';
  }
}

export async function prepareTracking(): Promise<PermissionStatus> {
  const status = await requestLocation();
  if (status === 'granted') {
    await requestNotifications();
  }
  return status;
}

export function useTripTracking(tripId: string | null) {
  const tracker = useQuery(
    tripId ? tripQueryKeys.tracker(tripId) : null,
    locationTracker.getState,
    { intervalMs: TRACKER_POLL_MS },
  );
  const [issue, setIssue] = useState<TrackingIssue | null>(null);
  const resumedFor = useRef<string | null>(null);
  const { reload } = tracker;

  const startFor = useCallback(
    async (id: string) => {
      const result = await locationTracker.start(id);
      setIssue(await issueFromStart(result));
      if (result === 'started') {
        await reload(true);
      }
    },
    [reload],
  );

  useEffect(() => {
    if (
      !tripId ||
      tracker.loading ||
      tracker.data !== null ||
      resumedFor.current === tripId
    ) {
      return;
    }
    resumedFor.current = tripId;
    startFor(tripId);
  }, [tripId, tracker.loading, tracker.data, startFor]);

  useEffect(() => {
    if (issue !== 'blocked' || !tripId) {
      return;
    }
    const subscription = AppState.addEventListener('change', async state => {
      if (state === 'active' && (await getLocationStatus()) === 'granted') {
        await startFor(tripId);
      }
    });
    return () => subscription.remove();
  }, [issue, tripId, startFor]);

  const turnOn = useCallback(async () => {
    if (!tripId) {
      return;
    }
    const permissionIssue = issueFromPermission(await prepareTracking());
    if (permissionIssue) {
      setIssue(permissionIssue);
      return;
    }
    await startFor(tripId);
  }, [tripId, startFor]);

  return {
    state: tracker.data,
    issue,
    stopped: issue !== null || tracker.data === null,
    turnOn,
    reload,
  };
}
