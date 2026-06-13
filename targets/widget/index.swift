import WidgetKit
import SwiftUI
import MapKit
import AppIntents

enum WidgetVariant {
  case nearest   // single spot (cyclable) + photo
  case map       // map snapshot + nearest list
  case photos    // closest spots as tappable photos
}

extension WidgetConfiguration {
  /// Opt out of iOS 17's default content margins so the map and photos bleed to
  /// the widget's rounded edge — the container radius is the only frame.
  /// No-op on iOS < 17, where widgets are already edge-to-edge.
  func edgeToEdge() -> some WidgetConfiguration {
    if #available(iOS 17.0, *) {
      return self.contentMarginsDisabled()
    } else {
      return self
    }
  }
}

struct SpotEntry: TimelineEntry {
  let date: Date
  let payload: WidgetPayload?
  let snapshot: UIImage?         // map widget
  let thumbnails: [UIImage?]     // nearest (up to 5) / photos (up to 4), index-aligned
  let selectedIndex: Int         // nearest widget: which spot is shown
}

// Interactive "next" arrow — advances the Nearest Spot widget to the next spot
// without leaving the Home Screen (iOS 17+). WidgetKit reloads after perform().
@available(iOS 17.0, *)
struct NextSpotIntent: AppIntent {
  static var title: LocalizedStringResource = "Next nearby spot"
  func perform() async throws -> some IntentResult {
    let defaults = UserDefaults(suiteName: appGroupId)
    let count = max(1, min(5, loadPayload()?.spots.count ?? 1))
    let current = defaults?.integer(forKey: selectedIndexKey) ?? 0
    defaults?.set((current + 1) % count, forKey: selectedIndexKey)
    return .result()
  }
}

struct Provider: TimelineProvider {
  let variant: WidgetVariant

  private func empty(_ payload: WidgetPayload?) -> SpotEntry {
    SpotEntry(date: Date(), payload: payload, snapshot: nil, thumbnails: [], selectedIndex: 0)
  }

  func placeholder(in context: Context) -> SpotEntry { empty(nil) }

  func getSnapshot(in context: Context, completion: @escaping (SpotEntry) -> Void) {
    completion(empty(loadPayload()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SpotEntry>) -> Void) {
    let payload = loadPayload()

    guard let payload = payload, !payload.spots.isEmpty else {
      // Push-driven: never auto-refresh. The app reloads us when data changes,
      // and the "next" intent reloads us when the user cycles.
      completion(Timeline(entries: [empty(payload)], policy: .never))
      return
    }

    Task {
      var snapshot: UIImage?
      var thumbnails: [UIImage?] = []
      var selectedIndex = 0

      switch variant {
      case .map:
        if let lat = payload.userLat, let lng = payload.userLng {
          // Landscape: the map fills the full-width top band of the medium/large
          // widget, so a wide snapshot crops gracefully when filled.
          snapshot = await renderMapSnapshot(
            center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
            spots: Array(payload.spots.prefix(12)),
            size: CGSize(width: 380, height: 220)
          )
        }
      case .nearest:
        let count = min(5, payload.spots.count)
        selectedIndex = min(max(0, loadSelectedIndex()), count - 1)
        thumbnails = await loadThumbnails(Array(payload.spots.prefix(count)))
      case .photos:
        thumbnails = await loadThumbnails(Array(payload.spots.prefix(4)))
      }

      completion(Timeline(entries: [SpotEntry(date: Date(), payload: payload,
                                              snapshot: snapshot, thumbnails: thumbnails,
                                              selectedIndex: selectedIndex)],
                          policy: .never))
    }
  }

  /// Download spot photos in parallel, preserving order.
  private func loadThumbnails(_ spots: [NearbySpot]) async -> [UIImage?] {
    await withTaskGroup(of: (Int, UIImage?).self) { group in
      for (i, spot) in spots.enumerated() {
        group.addTask { (i, await loadImage(spot.thumbnail)) }
      }
      var result = [UIImage?](repeating: nil, count: spots.count)
      for await (i, img) in group { result[i] = img }
      return result
    }
  }
}

// MARK: - Widget 1: the nearest spot (cyclable)

struct NearestSpotWidget: Widget {
  let kind = "NearestSpotWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider(variant: .nearest)) { entry in
      NearestSpotView(entry: entry)
    }
    .configurationDisplayName("Nearest Spot")
    .description("The skate spot closest to you — tap › to cycle through nearby spots.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .edgeToEdge()
  }
}

// MARK: - Widget 2: the spot map + nearest list

struct SpotMapWidget: Widget {
  let kind = "SpotMapWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider(variant: .map)) { entry in
      SpotMapView(entry: entry)
    }
    .configurationDisplayName("Spot Map")
    .description("A map of skate spots near you.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .edgeToEdge()
  }
}

// MARK: - Widget 3: photos of the closest spots (each tappable)

struct TopSpotsWidget: Widget {
  let kind = "TopSpotsWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider(variant: .photos)) { entry in
      TopSpotsView(entry: entry)
    }
    .configurationDisplayName("Top Spots")
    .description("Photos of the closest spots — tap one to open it.")
    .supportedFamilies([.systemMedium, .systemLarge])
    .edgeToEdge()
  }
}

@main
struct SkateSpotsBundle: WidgetBundle {
  var body: some Widget {
    NearestSpotWidget()
    SpotMapWidget()
    TopSpotsWidget()
  }
}
