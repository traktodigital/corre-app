export const tripQueryKeys = {
  deliveryApps: 'delivery-apps',
  openTrip: (userId: string) => `open-trip:${userId}`,
  todaySummary: (userId: string) => `today-summary:${userId}`,
  tracker: (tripId: string) => `tracker:${tripId}`,
  tripSummary: (tripId: string) => `trip-summary:${tripId}`,
  tripPeriod: (tripId: string) => `trip-period:${tripId}`,
  route: (file: string) => `route:${file}`,
};
