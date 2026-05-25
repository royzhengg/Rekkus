const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const sentryOrganization = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const suffix =
  appEnv === "staging" ? ".staging" : appEnv === "beta" ? ".beta" : "";
const schemeSuffix =
  appEnv === "staging" ? "-staging" : appEnv === "beta" ? "-beta" : "";
const displaySuffix =
  appEnv === "staging" ? " Staging" : appEnv === "beta" ? " Beta" : "";
const iosBuildNumber = process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER ?? "1";
const androidVersionCode = Number.parseInt(
  process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE ?? "1",
  10
);

export default {
  expo: {
    name: `Rekkus${displaySuffix}`,
    slug: "rekkus",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: `rekkus${schemeSuffix}`,
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: `com.anonymous.rekkus${suffix}`,
      buildNumber: iosBuildNumber,
      config: {
        googleMapsApiKey: googleMapsKey,
      },
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Allow Rekkus to access your photos so you can share them in posts and messages.",
        NSCameraUsageDescription:
          "Allow Rekkus to use your camera to take photos and videos.",
        NSMicrophoneUsageDescription:
          "Allow Rekkus to use your microphone to record videos.",
      },
    },
    android: {
      versionCode: Number.isFinite(androidVersionCode) ? androidVersionCode : 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: `com.anonymous.rekkus${suffix}`,
      config: {
        googleMaps: {
          apiKey: googleMapsKey,
        },
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "@sentry/react-native/expo",
        {
          organization: sentryOrganization,
          project: sentryProject,
        },
      ],
      "expo-sqlite",
      "react-native-compressor",
      [
        "expo-notifications",
        {
          color: "#000000",
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow Rekkus to use your location for nearby search results.",
          locationWhenInUsePermission:
            "Allow Rekkus to use your location for nearby search results.",
          isIosBackgroundLocationEnabled: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Allow Rekkus to access your photos so you can share them in posts and messages.",
          cameraPermission:
            "Allow Rekkus to use your camera to take photos and videos.",
        },
      ],
      [
        "expo-camera",
        {
          cameraPermission:
            "Allow Rekkus to use your camera to take photos and videos.",
          microphonePermission:
            "Allow Rekkus to use your microphone to record videos.",
          recordAudioAndroid: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      sentryDsn,
      eas: {
        projectId: "e5fdfa50-263d-4b18-b095-193d912a6b56",
      },
    },
  },
};
