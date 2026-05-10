const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

export default {
  expo: {
    name: "Rekkus",
    slug: "rekkus",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rekkus",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.rekkus",
      config: {
        googleMapsApiKey: googleMapsKey,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.rekkus",
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
      "expo-sqlite",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow Rekkus to use your location for nearby search results.",
        },
      ],
      [
        "react-native-maps",
        {
          googleMapsApiKey: googleMapsKey,
          iosGoogleMapsApiKey: googleMapsKey,
          androidGoogleMapsApiKey: googleMapsKey,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
