module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z-]+)?|@react-native(-community)?|@react-navigation|react-native-svg)/)',
  ],
  moduleNameMapper: {
    // O preset resolve a build ESM (.mjs); no Jest usamos a CJS.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
    // Mesmo alias do metro.config.js (RN 0.87 sem @react-native/assets-registry).
    '^@react-native/assets-registry/registry$':
      '<rootDir>/node_modules/react-native/src/asset-registry.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/goias-delivery-link'],
};
