import { Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
  type PhotoQuality,
} from 'react-native-image-picker';
import { requestCamera } from '../../permissions';
import type { LocalFile } from '../types';

export type PhotoResult =
  | { status: 'picked'; file: LocalFile }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'error' };

export type PhotoOptions = {
  quality?: PhotoQuality;
  maxWidth?: number;
  maxHeight?: number;
};

const DEFAULT_OPTIONS = {
  quality: 0.5 as PhotoQuality,
  maxWidth: 1280,
  maxHeight: 1280,
};

const DEFAULT_IMAGE_TYPE = 'image/jpeg';

function photoOptions(options: PhotoOptions) {
  return { mediaType: 'photo' as const, ...DEFAULT_OPTIONS, ...options };
}

async function safely(
  launch: () => Promise<ImagePickerResponse>,
): Promise<ImagePickerResponse | null> {
  try {
    return (await launch()) ?? null;
  } catch {
    return null;
  }
}

function needsAndroidCameraPermission(response: ImagePickerResponse) {
  return (
    Platform.OS === 'android' &&
    response.errorCode === 'others' &&
    (response.errorMessage ?? '').includes('permission.CAMERA')
  );
}

function toResult(response: ImagePickerResponse | null): PhotoResult {
  if (!response) {
    return { status: 'error' };
  }
  if (response.didCancel) {
    return { status: 'cancelled' };
  }
  if (response.errorCode === 'permission') {
    return { status: 'denied' };
  }
  if (response.errorCode === 'camera_unavailable') {
    return { status: 'unavailable' };
  }
  if (response.errorCode) {
    return { status: 'error' };
  }
  const asset = response.assets?.[0];
  if (!asset?.uri) {
    return { status: 'cancelled' };
  }
  return {
    status: 'picked',
    file: { uri: asset.uri, type: asset.type ?? DEFAULT_IMAGE_TYPE },
  };
}

export async function takePhoto(
  options: PhotoOptions = {},
): Promise<PhotoResult> {
  const cameraOptions = { ...photoOptions(options), saveToPhotos: false };
  let response = await safely(() => launchCamera(cameraOptions));
  if (response && needsAndroidCameraPermission(response)) {
    if ((await requestCamera()) !== 'granted') {
      return { status: 'denied' };
    }
    response = await safely(() => launchCamera(cameraOptions));
  }
  return toResult(response);
}

export async function pickFromGallery(
  options: PhotoOptions = {},
): Promise<PhotoResult> {
  const response = await safely(() =>
    launchImageLibrary({ ...photoOptions(options), selectionLimit: 1 }),
  );
  return toResult(response);
}
