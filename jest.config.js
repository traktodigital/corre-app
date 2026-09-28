module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z-]+)?|@react-native(-community)?|@react-navigation|react-native-svg)/)',
  ],
  moduleNameMapper: {
    // O preset resolve a build ESM (.mjs); no Jest usamos a CJS.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/goias-delivery-link'],
};
