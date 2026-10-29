// The spot map on Android. Google Maps when the build has a Maps key and the
// phone has Google Play services; MapLibre (keyless, no Google) otherwise,
// e.g. on GrapheneOS. Decided once at startup: neither can change while the
// app runs. iOS uses SpotMapView.tsx (Apple Maps).
import React from "react";
import Constants from "expo-constants";
import RNMapView, { Marker, type MapViewProps } from "react-native-maps";
import { isPlayServicesAvailable } from "~/modules/play-services";
import { MapLibreSpotMapMarker, MapLibreSpotMapView } from "./MapLibreSpotMap";
import { GOOGLE_DARK_STYLE } from "./google-dark-style";

export const USES_GOOGLE_MAPS =
  Constants.expoConfig?.extra?.androidGoogleMaps === true && isPlayServicesAvailable();

// The app is dark-only; Google Maps on Android ignores userInterfaceStyle.
const DarkGoogleMapView = React.forwardRef<RNMapView, MapViewProps>(
  function DarkGoogleMapView(props, ref) {
    return <RNMapView ref={ref} customMapStyle={GOOGLE_DARK_STYLE} {...props} />;
  },
);

export const SpotMapView = USES_GOOGLE_MAPS ? DarkGoogleMapView : MapLibreSpotMapView;
export const SpotMapMarker = USES_GOOGLE_MAPS ? Marker : MapLibreSpotMapMarker;
// The screens pass it to react-native-maps: the default is Google on Android.
export const PROVIDER_DEFAULT = undefined;
