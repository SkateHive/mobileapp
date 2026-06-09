/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "SkateSpots",
  displayName: "Nearby Spots",
  // Match the main app so the static-map (MKMapSnapshotter) fallback can serve
  // iOS 15–16, while iOS 17+ uses the live SwiftUI Map.
  deploymentTarget: "15.1",
  frameworks: ["SwiftUI", "WidgetKit", "MapKit"],
  // App Group is also auto-mirrored from app.json's ios.entitlements, but we
  // declare it explicitly so the target's generated.entitlements is unambiguous.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.bgrana.skatehive"],
  },
  colors: {
    $accent: "#32CD32",
  },
};
