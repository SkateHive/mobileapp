// The spot map on iOS: react-native-maps, which draws Apple Maps there.
// Android resolves SpotMapView.android.tsx instead (MapLibre, no Google
// services needed), so this file is all iOS ever bundles.
export {
  default as SpotMapView,
  Marker as SpotMapMarker,
  PROVIDER_DEFAULT,
} from "react-native-maps";
