import Foundation

// Must match the App Group declared in app.json (ios.entitlements) and the
// WidgetBridge native module. The app writes the JSON payload here; the widget reads it.
let appGroupId = "group.com.bgrana.skatehive"
let payloadKey = "nearbySpotsV1"

// One nearby spot, as written by the RN side (lib/widgets/spotWidget.ts).
// `href` is the canonical in-app path ("/spot/<author>/<permlink>") so the
// widget can deep-link without re-deriving it.
struct NearbySpot: Codable, Identifiable, Hashable {
  let id: String
  let name: String
  let lat: Double
  let lng: Double
  let distanceKm: Double?
  let author: String?
  let source: String?
  let thumbnail: String?
  let href: String
}

struct WidgetPayload: Codable {
  let updatedAt: Double          // epoch seconds
  let userLat: Double?
  let userLng: Double?
  let spots: [NearbySpot]
}

/// Reads the latest payload the app pushed into the shared App Group.
func loadPayload() -> WidgetPayload? {
  guard
    let defaults = UserDefaults(suiteName: appGroupId),
    let raw = defaults.string(forKey: payloadKey),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(WidgetPayload.self, from: data)
}

/// Mirror of lib/spotmap/geo.ts `formatDistance` so labels match the app.
func formatDistance(_ km: Double) -> String {
  if km < 1 { return "\(Int((km * 1000).rounded())) m" }
  if km < 10 { return String(format: "%.1f km", km) }
  return "\(Int(km.rounded())) km"
}

/// Builds a "myapp://" deep link from an in-app path ("/spot/..", "/map").
func appURL(_ path: String) -> URL? {
  URL(string: "myapp://\(path)")
}
