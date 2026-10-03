const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // RN 0.87 tirou o pacote @react-native/assets-registry; o react-native-svg
    // (usado pelo QR da carteirinha) ainda importa dele. Aponta pro entry point novo.
    resolveRequest: (context, moduleName, platform) =>
      context.resolveRequest(
        context,
        moduleName === '@react-native/assets-registry/registry'
          ? 'react-native/asset-registry'
          : moduleName,
        platform,
      ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
