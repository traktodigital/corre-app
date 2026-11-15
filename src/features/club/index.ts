import { buscarEconomia } from './api';

export { BeneficiosScreen as BenefitsScreen } from './BeneficiosScreen';
export { HistoricoScreen as RedemptionHistoryScreen } from './HistoricoScreen';
export { OfertaScreen as OfferScreen } from './OfertaScreen';
export { ParceiroScreen as PartnerScreen } from './ParceiroScreen';
export { ResgateScreen as RedemptionScreen } from './ResgateScreen';

export type Savings = { total: number; validatedThisMonth: number };

export async function fetchSavings(userId: string): Promise<Savings> {
  const r = await buscarEconomia(userId);
  return { total: r.total, validatedThisMonth: r.validadosNoMes };
}
