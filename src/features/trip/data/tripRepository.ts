import { supabase } from '../../../core/supabase/client';
import type { LocalFile } from '../../../core/device/types';
import { todayInBrasilia } from '../../../shared/date';
import {
  parseRoute,
  type DeliveryApp,
  type Fuel,
  type NewTrip,
  type OpenTrip,
  type Refuel,
  type RoutePoint,
  type TripClosing,
  type TripEarning,
  type TripListItem,
  type TripPeriod,
  type TripSummary,
} from '../domain';

const BUCKET = 'jornada-fotos';
const DAY_MS = 86_400_000;
const UNIQUE_VIOLATION = '23505';
const ALREADY_CLOSED = 'jornada ja encerrada';
export const TRIP_PAGE_SIZE = 20;

const FUEL_TO_DB: Record<Fuel, string> = {
  gasoline: 'gasolina',
  ethanol: 'etanol',
};

type DeliveryAppRow = { id: string; nome: string };

type OpenTripRow = {
  id: string;
  iniciada_em: string;
  odometro_inicio: number | null;
  combustivel: string | null;
  jornada_ganhos: { app_id: string }[] | null;
};

type SummaryRow = {
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
  por_app:
    | {
        app: string;
        valor: number | null;
        corridas: number | null;
        por_corrida: number | null;
      }[]
    | null;
};

function fuelFromDb(value: string | null): Fuel | null {
  if (value === FUEL_TO_DB.gasoline) {
    return 'gasoline';
  }
  if (value === FUEL_TO_DB.ethanol) {
    return 'ethanol';
  }
  return null;
}

function toOpenTrip(row: OpenTripRow): OpenTrip {
  return {
    id: row.id,
    startedAt: row.iniciada_em,
    startOdometer: row.odometro_inicio,
    fuel: fuelFromDb(row.combustivel),
    appIds: (row.jornada_ganhos ?? []).map(g => g.app_id),
  };
}

function toSummary(row: SummaryRow): TripSummary {
  return {
    trips: row.jornadas,
    km: row.km,
    hours: row.horas,
    liters: row.litros,
    fuelCost: row.gasto_combustivel,
    totalEarnings: row.ganho_total,
    profit: row.lucro,
    costPerKm: row.custo_km,
    earningsPerKm: row.ganho_km,
    earningsPerHour: row.ganho_hora,
    byApp: (row.por_app ?? []).map(a => ({
      appId: a.app,
      amount: a.valor,
      rides: a.corridas,
      perRide: a.por_corrida,
    })),
  };
}

function extensionFor(mimeType: string) {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'text/csv':
      return 'csv';
    case 'image/png':
      return 'png';
    default:
      return 'jpg';
  }
}

export async function listDeliveryApps(): Promise<DeliveryApp[]> {
  const { data, error } = await supabase
    .from('apps_entrega')
    .select('id, nome')
    .eq('ativo', true)
    .order('ordem');
  if (error) {
    throw error;
  }
  return ((data ?? []) as DeliveryAppRow[]).map(row => ({
    id: row.id,
    name: row.nome,
  }));
}

export async function fetchOpenTrip(): Promise<OpenTrip | null> {
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
  return data ? toOpenTrip(data as OpenTripRow) : null;
}

export async function uploadTripFile(
  userId: string,
  tripId: string,
  name: string,
  file: LocalFile,
): Promise<string> {
  const path = `${userId}/${tripId}/${name}-${Date.now()}.${extensionFor(
    file.type,
  )}`;
  const body = await (await fetch(file.uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType: file.type });
  if (error) {
    throw error;
  }
  return path;
}

export async function openTrip(input: NewTrip): Promise<string> {
  let tripId: string;
  const { data, error } = await supabase
    .from('jornadas')
    .insert({
      combustivel: FUEL_TO_DB[input.fuel],
      odometro_inicio: input.odometer,
      nivel_tanque_inicio: input.tankLevel,
    })
    .select('id')
    .single();
  if (error) {
    const existing =
      error.code === UNIQUE_VIOLATION ? await fetchOpenTrip() : null;
    if (!existing) {
      throw error;
    }
    tripId = existing.id;
  } else {
    tripId = data.id as string;
  }
  const { error: appsError } = await supabase.from('jornada_ganhos').upsert(
    input.appIds.map(appId => ({ jornada_id: tripId, app_id: appId })),
    { onConflict: 'jornada_id,app_id', ignoreDuplicates: true },
  );
  if (appsError) {
    throw appsError;
  }
  return tripId;
}

export async function saveStartPanelPhoto(tripId: string, path: string) {
  const { error } = await supabase
    .from('jornadas')
    .update({ foto_painel_inicio: path })
    .eq('id', tripId);
  if (error) {
    throw error;
  }
}

export async function createRefuel(refuel: Refuel) {
  const { error } = await supabase.from('abastecimentos').insert({
    jornada_id: refuel.tripId,
    combustivel: FUEL_TO_DB[refuel.fuel],
    litros: refuel.liters,
    valor_total: refuel.totalPrice,
    odometro: refuel.odometer,
    posto: refuel.station.trim() || null,
    foto_cupom: refuel.receiptPhoto,
    foto_odometro: refuel.odometerPhoto,
    foto_marcador: refuel.gaugePhoto,
  });
  if (error) {
    throw error;
  }
}

export async function saveEarning(tripId: string, earning: TripEarning) {
  const { error } = await supabase
    .from('jornada_ganhos')
    .update({
      valor: earning.amount,
      corridas: earning.rides,
      comprovantes: earning.receipts,
    })
    .eq('jornada_id', tripId)
    .eq('app_id', earning.appId);
  if (error) {
    throw error;
  }
}

export async function closeTrip(tripId: string, closing: TripClosing) {
  const { error } = await supabase
    .from('jornadas')
    .update({
      status: 'encerrada',
      km_gps:
        closing.gpsKm === null ? null : Math.round(closing.gpsKm * 100) / 100,
      odometro_fim: closing.endOdometer,
      foto_painel_fim: closing.endPanelPhoto,
      trajeto_path: closing.routePath,
    })
    .eq('id', tripId);
  if (error && !error.message.includes(ALREADY_CLOSED)) {
    throw error;
  }
}

export async function fetchTripSummary(tripId: string): Promise<TripSummary> {
  const { data, error } = await supabase.rpc('resumo_jornadas', {
    _jornada_id: tripId,
  });
  if (error) {
    throw error;
  }
  return toSummary(data as SummaryRow);
}

export async function fetchTripPeriod(tripId: string): Promise<TripPeriod> {
  const { data, error } = await supabase
    .from('jornadas')
    .select('iniciada_em, encerrada_em, trajeto_path')
    .eq('id', tripId)
    .single();
  if (error) {
    throw error;
  }
  const row = data as {
    iniciada_em: string;
    encerrada_em: string | null;
    trajeto_path: string | null;
  };
  return {
    startedAt: row.iniciada_em,
    endedAt: row.encerrada_em,
    routePath: row.trajeto_path,
  };
}

export async function readRouteFile(path: string): Promise<RoutePoint[]> {
  const response = await fetch(`file://${path}`);
  return parseRoute(await response.text());
}

export async function downloadRoute(path: string): Promise<RoutePoint[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60);
  if (error) {
    throw error;
  }
  const response = await fetch(data.signedUrl);
  return parseRoute(await response.text());
}

type TripListRow = {
  id: string;
  iniciada_em: string;
  km_gps: number | null;
  odometro_inicio: number | null;
  odometro_fim: number | null;
  jornada_ganhos: { app_id: string; valor: number | null }[] | null;
};

export async function listClosedTrips(
  before?: string,
): Promise<TripListItem[]> {
  let query = supabase
    .from('jornadas')
    .select(
      'id, iniciada_em, km_gps, odometro_inicio, odometro_fim, jornada_ganhos(app_id, valor)',
    )
    .eq('status', 'encerrada')
    .order('iniciada_em', { ascending: false })
    .limit(TRIP_PAGE_SIZE);
  if (before) {
    query = query.lt('iniciada_em', before);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return ((data ?? []) as TripListRow[]).map(row => {
    const earnings = row.jornada_ganhos ?? [];
    const odometerKm =
      row.odometro_inicio !== null && row.odometro_fim !== null
        ? row.odometro_fim - row.odometro_inicio
        : 0;
    return {
      id: row.id,
      startedAt: row.iniciada_em,
      km: row.km_gps !== null ? Number(row.km_gps) : odometerKm,
      earnings: earnings.reduce((sum, g) => sum + Number(g.valor ?? 0), 0),
      appIds: earnings.map(g => g.app_id),
    };
  });
}

export async function fetchTodaySummary(): Promise<TripSummary> {
  const start = new Date(`${todayInBrasilia()}T00:00:00-03:00`);
  const end = new Date(start.getTime() + DAY_MS);
  const { data, error } = await supabase.rpc('resumo_jornadas', {
    _inicio: start.toISOString(),
    _fim: end.toISOString(),
  });
  if (error) {
    throw error;
  }
  return toSummary(data as SummaryRow);
}
