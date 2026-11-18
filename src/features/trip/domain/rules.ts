import type { Fuel } from './types';

const MAX_ODOMETER = 999_999;
const MAX_REFUEL_PRICE = 2000;
const MAX_REFUEL_LITERS = 100;
const MAX_DAILY_KM = 1500;
const MAX_APP_EARNING = 5000;

function digitsToNumber(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

export function parseBrazilianNumber(text: string): number | null {
  const compact = text.trim().replace(/\s/g, '');
  if (!compact) {
    return null;
  }
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseOdometer(text: string): number | null {
  return digitsToNumber(text);
}

export function parseRideCount(text: string): number | null {
  return digitsToNumber(text);
}

export function validateStart(input: {
  appIds: string[];
  hasPhoto: boolean;
  fuel: Fuel | null;
  odometer: string;
}): string | null {
  if (input.appIds.length === 0) {
    return 'Marca pelo menos um app que você vai rodar.';
  }
  if (!input.hasPhoto) {
    return 'Falta a foto do painel. É ela que mostra o km e o tanque.';
  }
  if (!input.fuel) {
    return 'Gasolina ou etanol?';
  }
  const km = parseOdometer(input.odometer);
  if (km === null || km > MAX_ODOMETER) {
    return 'Confere o km do odômetro.';
  }
  return null;
}

export function validateRefuel(input: {
  liters: string;
  price: string;
  odometer: string;
  fuel: Fuel | null;
  hasOdometerPhoto: boolean;
  hasGaugePhoto: boolean;
}): string | null {
  const price = parseBrazilianNumber(input.price);
  if (price === null || price <= 0 || price > MAX_REFUEL_PRICE) {
    return 'Confere o valor pago.';
  }
  const liters = parseBrazilianNumber(input.liters);
  if (liters === null || liters <= 0 || liters > MAX_REFUEL_LITERS) {
    return 'Confere quantos litros.';
  }
  if (!input.fuel) {
    return 'Gasolina ou etanol?';
  }
  if (parseOdometer(input.odometer) === null) {
    return 'Falta o km do odômetro.';
  }
  if (!input.hasOdometerPhoto || !input.hasGaugePhoto) {
    return 'Faltam as fotos do odômetro e do marcador.';
  }
  return null;
}

export function validateEnd(input: {
  hasPhoto: boolean;
  startOdometer: number | null;
  endOdometer: string;
  earnings: { app: string; amount: string }[];
}): string | null {
  if (!input.hasPhoto) {
    return 'Falta a foto do painel.';
  }
  const end = parseOdometer(input.endOdometer);
  if (end === null) {
    return 'Falta o km do odômetro.';
  }
  if (input.startOdometer !== null) {
    if (end < input.startOdometer) {
      return `O odômetro não pode ser menor que na abertura (${input.startOdometer} km).`;
    }
    if (end - input.startOdometer > MAX_DAILY_KM) {
      return 'Mais de 1.500 km num dia? Confere o odômetro.';
    }
  }
  for (const earning of input.earnings) {
    const amount = parseBrazilianNumber(earning.amount);
    if (amount === null || amount < 0 || amount > MAX_APP_EARNING) {
      return `Quanto o ${earning.app} pagou hoje? Se não rodou nele, coloca 0.`;
    }
  }
  return null;
}

export function formatKm(km: number | null | undefined): string {
  const value = km ?? 0;
  return `${value.toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}min`
    : `${minutes}min`;
}

export function trackerNeedsStart(
  tripId: string,
  tracker: { active: boolean; tripId: string } | null | undefined,
): boolean {
  return !tracker || !tracker.active || tracker.tripId !== tripId;
}
