import { supabase } from '../../lib/supabase';
import { hojeEmBrasilia } from '../clube/api';
import type { Combustivel } from './regras';

/** Dados da jornada do dia (docs/backend/partes/8-jornada.sql, ADR-0005). */

const BUCKET = 'jornada-fotos';

export type AppEntrega = { id: string; nome: string };

export type JornadaAberta = {
  id: string;
  iniciada_em: string;
  odometro_inicio: number | null;
  combustivel: Combustivel | null;
  apps: string[];
};

export type Resumo = {
  jornadas: number;
  km: number;
  horas: number;
  litros: number;
  gasto_combustivel: number;
  ganho_total: number;
  lucro: number;
  custo_km: number | null;
  ganho_km: number | null;
  ganho_hora: number | null;
  por_app: {
    app: string;
    valor: number | null;
    corridas: number | null;
    por_corrida: number | null;
  }[];
};

/** Arquivo local pronto pra subir (foto da câmera, print/PDF escolhido). */
export type Arquivo = { uri: string; tipo: string };

export async function listarApps(): Promise<AppEntrega[]> {
  const { data, error } = await supabase
    .from('apps_entrega')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem');
  if (error) {
    throw error;
  }
  return data ?? [];
}

/** A RLS já limita ao dono; o índice único garante no máximo uma aberta. */
export async function buscarJornadaAberta(): Promise<JornadaAberta | null> {
  const { data, error } = await supabase
    .from('jornadas')
    .select(
      'id, iniciada_em, odometro_inicio, combustivel, jornada_ganhos(app_id)',
    )
    .eq('status', 'em_andamento')
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const { jornada_ganhos, ...j } = data as Omit<JornadaAberta, 'apps'> & {
    jornada_ganhos: { app_id: string }[] | null;
  };
  return { ...j, apps: (jornada_ganhos ?? []).map(g => g.app_id) };
}

/** Sobe pro Storage em <uid>/<jornada>/<nome>-<epoch>.<ext> (política: pasta do dono). */
export async function enviarArquivo(
  uid: string,
  jornadaId: string,
  nome: string,
  a: Arquivo,
): Promise<string> {
  const ext =
    a.tipo === 'application/pdf'
      ? 'pdf'
      : a.tipo === 'text/csv'
      ? 'csv'
      : a.tipo === 'image/png'
      ? 'png'
      : 'jpg';
  const caminho = `${uid}/${jornadaId}/${nome}-${Date.now()}.${ext}`;
  const corpo = await (await fetch(a.uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, corpo, { contentType: a.tipo });
  if (error) {
    throw error;
  }
  return caminho;
}

/**
 * Abre a jornada (horário e dono vêm do servidor) e marca os apps do dia.
 * Toque duplo / retry de rede: o índice único devolve a jornada já aberta,
 * e os apps entram com upsert — rodar de novo não duplica nada.
 */
export async function abrirJornada(d: {
  apps: string[];
  combustivel: Combustivel;
  odometro: number;
  nivelTanque: number | null;
}): Promise<string> {
  let id: string;
  const { data, error } = await supabase
    .from('jornadas')
    .insert({
      combustivel: d.combustivel,
      odometro_inicio: d.odometro,
      nivel_tanque_inicio: d.nivelTanque,
    })
    .select('id')
    .single();
  if (error) {
    const aberta = error.code === '23505' ? await buscarJornadaAberta() : null;
    if (!aberta) {
      throw error;
    }
    id = aberta.id;
  } else {
    id = data.id as string;
  }
  const { error: erroApps } = await supabase.from('jornada_ganhos').upsert(
    d.apps.map(app_id => ({ jornada_id: id, app_id })),
    { onConflict: 'jornada_id,app_id', ignoreDuplicates: true },
  );
  if (erroApps) {
    throw erroApps;
  }
  return id;
}

export async function salvarFotoPainelInicio(
  jornadaId: string,
  caminho: string,
) {
  const { error } = await supabase
    .from('jornadas')
    .update({ foto_painel_inicio: caminho })
    .eq('id', jornadaId);
  if (error) {
    throw error;
  }
}

export async function registrarAbastecimento(d: {
  jornadaId: string;
  combustivel: Combustivel;
  litros: number;
  valorTotal: number;
  odometro: number;
  posto: string;
  fotoCupom: string | null;
  fotoOdometro: string;
  fotoMarcador: string;
}) {
  const { error } = await supabase.from('abastecimentos').insert({
    jornada_id: d.jornadaId,
    combustivel: d.combustivel,
    litros: d.litros,
    valor_total: d.valorTotal,
    odometro: d.odometro,
    posto: d.posto.trim() || null,
    foto_cupom: d.fotoCupom,
    foto_odometro: d.fotoOdometro,
    foto_marcador: d.fotoMarcador,
  });
  if (error) {
    throw error;
  }
}

export async function salvarGanho(
  jornadaId: string,
  g: {
    app: string;
    valor: number;
    corridas: number | null;
    comprovantes: string[];
  },
) {
  const { error } = await supabase
    .from('jornada_ganhos')
    .update({
      valor: g.valor,
      corridas: g.corridas,
      comprovantes: g.comprovantes,
    })
    .eq('jornada_id', jornadaId)
    .eq('app_id', g.app);
  if (error) {
    throw error;
  }
}

/** Encerra (horário do servidor; o banco marca `suspeita`). Reenvio após sucesso não é erro. */
export async function fecharJornada(
  jornadaId: string,
  d: {
    kmGps: number | null;
    odometroFim: number;
    fotoPainelFim: string;
    trajetoPath: string | null;
  },
) {
  const { error } = await supabase
    .from('jornadas')
    .update({
      status: 'encerrada',
      km_gps: d.kmGps === null ? null : Math.round(d.kmGps * 100) / 100,
      odometro_fim: d.odometroFim,
      foto_painel_fim: d.fotoPainelFim,
      trajeto_path: d.trajetoPath,
    })
    .eq('id', jornadaId);
  if (error && !error.message.includes('jornada ja encerrada')) {
    throw error;
  }
}

export async function resumoJornada(jornadaId: string): Promise<Resumo> {
  const { data, error } = await supabase.rpc('resumo_jornadas', {
    _jornada_id: jornadaId,
  });
  if (error) {
    throw error;
  }
  return data as Resumo;
}

/** Hoje no relógio de Brasília (UTC-3, sem horário de verão). */
export async function resumoHoje(): Promise<Resumo> {
  const inicio = new Date(`${hojeEmBrasilia()}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 86_400_000);
  const { data, error } = await supabase.rpc('resumo_jornadas', {
    _inicio: inicio.toISOString(),
    _fim: fim.toISOString(),
  });
  if (error) {
    throw error;
  }
  return data as Resumo;
}
