import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import type { LocalFile } from '../types';

export type FileKind = 'image' | 'pdf';

export type PickFilesResult =
  | { status: 'picked'; files: LocalFile[] }
  | { status: 'cancelled' }
  | { status: 'error' };

export type PickFilesOptions = {
  kinds?: FileKind[];
  multiple?: boolean;
};

const MIME_BY_KIND: Record<FileKind, string> = {
  image: types.images,
  pdf: types.pdf,
};

const FALLBACK_NAME = 'arquivo';
const FALLBACK_TYPE = 'application/octet-stream';

export async function pickFiles({
  kinds = ['image', 'pdf'],
  multiple = true,
}: PickFilesOptions = {}): Promise<PickFilesResult> {
  try {
    const picked = await pick({
      allowMultiSelection: multiple,
      type: kinds.map(kind => MIME_BY_KIND[kind]),
    });
    if (!picked?.length) {
      return { status: 'cancelled' };
    }
    const [first, ...rest] = picked.map(file => ({
      uri: file.uri,
      fileName: file.name ?? FALLBACK_NAME,
    }));
    const copies = await keepLocalCopy({
      files: [first, ...rest],
      destination: 'cachesDirectory',
    });
    const files = copies.flatMap((copy, i) =>
      copy.status === 'success'
        ? [{ uri: copy.localUri, type: picked[i]?.type ?? FALLBACK_TYPE }]
        : [],
    );
    return { status: 'picked', files };
  } catch (error) {
    if (
      isErrorWithCode(error) &&
      error.code === errorCodes.OPERATION_CANCELED
    ) {
      return { status: 'cancelled' };
    }
    return { status: 'error' };
  }
}
