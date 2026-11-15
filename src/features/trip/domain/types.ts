export type Fuel = 'gasoline' | 'ethanol';

export type DeliveryApp = { id: string; name: string };

export type Trip = {
  id: string;
  startedAt: string;
  startOdometer: number | null;
  fuel: Fuel | null;
};

export type OpenTrip = Trip & { appIds: string[] };

export type NewTrip = {
  appIds: string[];
  fuel: Fuel;
  odometer: number;
  tankLevel: number | null;
};

export type Refuel = {
  tripId: string;
  fuel: Fuel;
  liters: number;
  totalPrice: number;
  odometer: number;
  station: string;
  receiptPhoto: string | null;
  odometerPhoto: string;
  gaugePhoto: string;
};

export type TripEarning = {
  appId: string;
  amount: number;
  rides: number | null;
  receipts: string[];
};

export type TripClosing = {
  gpsKm: number | null;
  endOdometer: number;
  endPanelPhoto: string;
  routePath: string | null;
};

export type AppEarningSummary = {
  appId: string;
  amount: number | null;
  rides: number | null;
  perRide: number | null;
};

export type TripSummary = {
  trips: number;
  km: number;
  hours: number;
  liters: number;
  fuelCost: number;
  totalEarnings: number;
  profit: number;
  costPerKm: number | null;
  earningsPerKm: number | null;
  earningsPerHour: number | null;
  byApp: AppEarningSummary[];
};
