import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import Settings from 'lucide-react-native/icons/settings';
import { Button, Card, Text } from '../../../../shared/ui';
import { useTheme } from '../../../../shared/theme';
import {
  pickFromGallery,
  takePhoto,
  type PhotoResult,
} from '../../../../core/device/camera';
import { openSettings } from '../../../../core/permissions';
import type { LocalFile } from '../../../../core/device/types';

type Source = 'camera' | 'gallery';

type Problem = 'failed' | 'cameraDenied' | 'galleryDenied';

const PROBLEM_TEXT: Record<Problem, string> = {
  failed: 'Não deu pra abrir a câmera. Tenta pela galeria.',
  cameraDenied:
    'O CORRE está sem permissão pra câmera. Escolhe a foto pela galeria ou libera nos ajustes.',
  galleryDenied:
    'O CORRE está sem permissão pra galeria. Libera nos ajustes pra escolher a foto.',
};

function problemFor(source: Source, result: PhotoResult): Problem | null {
  switch (result.status) {
    case 'picked':
    case 'cancelled':
      return null;
    case 'denied':
      return source === 'camera' ? 'cameraDenied' : 'galleryDenied';
    default:
      return 'failed';
  }
}

export function PhotoField({
  title,
  hint,
  photo,
  onPhoto,
}: {
  title: string;
  hint: string;
  photo: LocalFile | null;
  onPhoto: (file: LocalFile) => void;
}) {
  const { colors, radius } = useTheme();
  const [problem, setProblem] = useState<Problem | null>(null);

  async function choose(source: Source) {
    setProblem(null);
    const result =
      source === 'camera' ? await takePhoto() : await pickFromGallery();
    if (result.status === 'picked') {
      onPhoto(result.file);
      return;
    }
    setProblem(problemFor(source, result));
  }

  const denied = problem === 'cameraDenied' || problem === 'galleryDenied';

  return (
    <Card style={styles.field}>
      <View style={styles.row}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={[styles.thumbnail, { borderRadius: radius.md }]}
            accessibilityLabel={`Foto: ${title}`}
          />
        ) : (
          <View
            style={[
              styles.thumbnail,
              styles.empty,
              { borderRadius: radius.md, borderColor: colors.border },
            ]}
          >
            <Camera size={22} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.texts}>
          <Text variant="title">{title}</Text>
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <Button
          title={photo ? 'Tirar de novo' : 'Tirar foto'}
          size="sm"
          variant={photo ? 'outline' : 'primary'}
          icon={
            <Camera
              size={16}
              color={photo ? colors.foreground : colors.primaryForeground}
            />
          }
          onPress={() => choose('camera')}
          style={styles.button}
        />
        <Button
          title="Galeria"
          size="sm"
          variant="ghost"
          icon={<ImageIcon size={16} color={colors.foreground} />}
          onPress={() => choose('gallery')}
        />
      </View>
      {problem ? (
        <Text variant="small" tone="danger">
          {PROBLEM_TEXT[problem]}
        </Text>
      ) : null}
      {denied ? (
        <Button
          title="Abrir ajustes"
          size="sm"
          variant="outline"
          icon={<Settings size={16} color={colors.foreground} />}
          onPress={openSettings}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  field: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbnail: { width: 64, height: 64 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
});
