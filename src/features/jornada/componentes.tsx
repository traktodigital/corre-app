import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Camera, FileText, ImageIcon } from 'lucide-react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { Button, Card, Text } from '../../components/ui';
import { formatarReal } from '../../lib/formato';
import { useTheme } from '../../theme';
import type { Arquivo, Resumo } from './api';
import { formatarKm } from './regras';

const OPCOES_FOTO = {
  mediaType: 'photo' as const,
  quality: 0.6 as const,
  maxWidth: 1600,
  maxHeight: 1600,
};

function arquivoDaResposta(r: ImagePickerResponse): Arquivo | null {
  if (r.didCancel) {
    return null;
  }
  if (r.errorCode) {
    throw new Error(r.errorMessage ?? r.errorCode);
  }
  const a = r.assets?.[0];
  return a?.uri ? { uri: a.uri, tipo: a.type ?? 'image/jpeg' } : null;
}

/** Foto obrigatória/opcional com miniatura: câmera primeiro, galeria como reserva. */
export function CampoFoto({
  titulo,
  dica,
  foto,
  onFoto,
}: {
  titulo: string;
  dica: string;
  foto: Arquivo | null;
  onFoto: (a: Arquivo) => void;
}) {
  const { colors, radius } = useTheme();
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(origem: 'camera' | 'galeria') {
    setErro(null);
    try {
      const r =
        origem === 'camera'
          ? await launchCamera({ ...OPCOES_FOTO, saveToPhotos: false })
          : await launchImageLibrary({ ...OPCOES_FOTO, selectionLimit: 1 });
      const a = arquivoDaResposta(r);
      if (a) {
        onFoto(a);
      }
    } catch {
      setErro('Não deu pra abrir a câmera. Tenta pela galeria.');
    }
  }

  return (
    <Card style={styles.campo}>
      <View style={styles.linha}>
        {foto ? (
          <Image
            source={{ uri: foto.uri }}
            style={[styles.miniatura, { borderRadius: radius.md }]}
            accessibilityLabel={`Foto: ${titulo}`}
          />
        ) : (
          <View
            style={[
              styles.miniatura,
              styles.vazia,
              { borderRadius: radius.md, borderColor: colors.border },
            ]}
          >
            <Camera size={22} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.textos}>
          <Text variant="title">{titulo}</Text>
          <Text variant="small" tone="muted">
            {dica}
          </Text>
        </View>
      </View>
      <View style={styles.botoes}>
        <Button
          title={foto ? 'Tirar de novo' : 'Tirar foto'}
          size="sm"
          variant={foto ? 'outline' : 'primary'}
          icon={
            <Camera
              size={16}
              color={foto ? colors.foreground : colors.primaryForeground}
            />
          }
          onPress={() => escolher('camera')}
          style={styles.botao}
        />
        <Button
          title="Galeria"
          size="sm"
          variant="ghost"
          icon={<ImageIcon size={16} color={colors.foreground} />}
          onPress={() => escolher('galeria')}
        />
      </View>
      {erro ? (
        <Text variant="small" tone="danger">
          {erro}
        </Text>
      ) : null}
    </Card>
  );
}

/** Prints ou PDFs do resumo de ganhos do app (vários de uma vez). */
export async function escolherComprovantes(): Promise<Arquivo[]> {
  try {
    const escolhidos = await pick({
      allowMultiSelection: true,
      type: [types.images, types.pdf],
    });
    const [primeiro, ...resto] = escolhidos.map(a => ({
      uri: a.uri,
      fileName: a.name ?? 'comprovante',
    }));
    // Cópia local: content:// do Android nem sempre dá pra ler com fetch.
    const copias = await keepLocalCopy({
      files: [primeiro, ...resto],
      destination: 'cachesDirectory',
    });
    return copias.flatMap((c, i) =>
      c.status === 'success'
        ? [
            {
              uri: c.localUri,
              tipo: escolhidos[i].type ?? 'application/octet-stream',
            },
          ]
        : [],
    );
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
      return [];
    }
    throw e;
  }
}

export function ContadorComprovantes({ total }: { total: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.linha}>
      <FileText
        size={16}
        color={total ? colors.highlight : colors.mutedForeground}
      />
      <Text variant="small" tone={total ? 'highlight' : 'muted'}>
        {total === 0
          ? 'Nenhum comprovante'
          : total === 1
          ? '1 comprovante'
          : `${total} comprovantes`}
      </Text>
    </View>
  );
}

/** Rodou · gastou · fez · sobrou — número primeiro (persona do Ligeirin). */
export function ResumoDia({
  resumo,
  nomeDoApp,
}: {
  resumo: Resumo;
  nomeDoApp: (id: string) => string;
}) {
  const sobrou = resumo.lucro;
  const blocos = [
    { rotulo: 'Rodou', valor: formatarKm(resumo.km) },
    { rotulo: 'Gastou', valor: formatarReal(resumo.gasto_combustivel) },
    { rotulo: 'Fez', valor: formatarReal(resumo.ganho_total) },
    { rotulo: 'Sobrou', valor: formatarReal(sobrou) },
  ];
  const appsComValor = resumo.por_app.filter(a => a.valor !== null);
  return (
    <View style={styles.resumo}>
      <View style={styles.grade}>
        {blocos.map(b => (
          <Card key={b.rotulo} style={styles.bloco} padding={14}>
            <Text variant="caption" tone="muted">
              {b.rotulo}
            </Text>
            <Text
              variant="h2"
              tone={
                b.rotulo === 'Sobrou'
                  ? sobrou >= 0
                    ? 'success'
                    : 'danger'
                  : 'default'
              }
            >
              {b.valor}
            </Text>
          </Card>
        ))}
      </View>
      <Card padding={14} style={styles.detalhes}>
        <Linha rotulo="Custo por km" valor={resumo.custo_km} />
        <Linha rotulo="Ganho por km" valor={resumo.ganho_km} />
        <Linha rotulo="Ganho por hora" valor={resumo.ganho_hora} />
        {appsComValor.length > 1 ? (
          <Text variant="tiny" tone="muted">
            Rodou em mais de um app: o ganho por km é a média do dia inteiro.
          </Text>
        ) : null}
      </Card>
      {appsComValor.length > 0 ? (
        <Card padding={14} style={styles.detalhes}>
          {appsComValor.map(a => (
            <View key={a.app} style={styles.linhaApp}>
              <Text variant="body">{nomeDoApp(a.app)}</Text>
              <Text variant="body">
                {formatarReal(a.valor ?? 0)}
                {a.por_corrida !== null ? (
                  <Text variant="small" tone="muted">
                    {`  ·  ${formatarReal(a.por_corrida)}/corrida`}
                  </Text>
                ) : null}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  return (
    <View style={styles.linhaApp}>
      <Text variant="small" tone="muted">
        {rotulo}
      </Text>
      <Text variant="small">{valor === null ? '—' : formatarReal(valor)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniatura: { width: 64, height: 64 },
  vazia: {
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: 2 },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: { flex: 1 },
  resumo: { gap: 12 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bloco: { flexGrow: 1, flexBasis: '45%', gap: 4 },
  detalhes: { gap: 8 },
  linhaApp: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
