// Armazenamento em memória no lugar do AsyncStorage nativo.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  const api = {
    getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
    setItem: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async key => {
      store.delete(key);
    }),
    clear: jest.fn(async () => store.clear()),
  };
  return { __esModule: true, default: api, ...api };
});
