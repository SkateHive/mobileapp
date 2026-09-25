import Foundation

// Must match the App Group declared in app.json (ios.entitlements) and the
// WidgetBridge native module. The app writes the JSON payload here; the widget reads it.
let appGroupId = "group.com.bgrana.skatehive"
let payloadKey = "nearbySpotsV1"
// Which nearby spot the Nearest Spot widget is currently showing (cycled by the
// interactive "next" arrow). Reset to 0 by the app whenever it pushes new data.
let selectedIndexKey = "selectedSpotIndexV1"

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

/// The language the widget text is shown in (en, pt-BR, pt-PT, es), resolved from the
/// widget bundle's localisations. Used instead of Locale.current so the decimal
/// separator follows the language, like the app does (lib/i18n/format.ts): a comma
/// in Portuguese and Spanish even when the device region says otherwise.
let displayLocale = Locale(identifier: Bundle.main.preferredLocalizations.first ?? "en")

/// Mirror of lib/spotmap/geo.ts `formatDistance` so labels match the app.
func formatDistance(_ km: Double) -> String {
  if km < 1 { return "\(Int((km * 1000).rounded())) m" }
  if km < 10 { return String(format: "%.1f km", locale: displayLocale, km) }
  return "\(Int(km.rounded())) km"
}

/// Index of the spot the Nearest Spot widget should show (App Group state).
func loadSelectedIndex() -> Int {
  UserDefaults(suiteName: appGroupId)?.integer(forKey: selectedIndexKey) ?? 0
}

/// HUD-style "last synced" stamp, e.g. "SYNC //14:48". Looked up in Localizable.xcstrings:
/// Text(String) does not localise, so this resolves the text itself.
func syncLabel(_ updatedAt: Double) -> String {
  guard updatedAt > 0 else { return NSLocalizedString("SYNC //--:--", comment: "Widget header before the first sync") }
  let f = DateFormatter()
  f.dateFormat = "HH:mm"
  return String(
    format: NSLocalizedString("SYNC //%@", comment: "Widget header: last sync time, e.g. 14:48"),
    f.string(from: Date(timeIntervalSince1970: updatedAt))
  )
}

/// Builds a "myapp://" deep link from an in-app path ("/spot/..", "/map").
func appURL(_ path: String) -> URL? {
  URL(string: "myapp://\(path)")
}
