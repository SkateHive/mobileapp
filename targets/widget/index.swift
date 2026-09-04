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

// Sample content for the widget gallery / placeholder. WidgetKit renders these
// before the app has pushed any real data, so the picker shows a lively widget
// instead of the "NO SIGNAL" empty state. Sample-only — never shown once the app
// has synced real spots. (Coords around Praça XV / Centro, Rio.)
private func sampleSpots() -> [NearbySpot] {
  [
    NearbySpot(id: "sample-1", name: "Praça XV Ledges", lat: -22.9028, lng: -43.1731,
               distanceKm: 0.4, author: "skatehive", source: "hive", thumbnail: nil, href: "/map"),
    NearbySpot(id: "sample-2", name: "Museu do Amanhã Gap", lat: -22.8940, lng: -43.1796,
               distanceKm: 1.1, author: nil, source: "google_my_maps", thumbnail: nil, href: "/map"),
    NearbySpot(id: "sample-3", name: "Lapa Arches", lat: -22.9130, lng: -43.1790,
               distanceKm: 1.8, author: "skatehive", source: "hive", thumbnail: nil, href: "/map"),
    NearbySpot(id: "sample-4", name: "Cinelândia Banks", lat: -22.9100, lng: -43.1760,
               distanceKm: 2.0, author: nil, source: "google_my_maps", thumbnail: nil, href: "/map"),
    NearbySpot(id: "sample-5", name: "Aterro do Flamengo", lat: -22.9300, lng: -43.1700,
               distanceKm: 3.2, author: "skatehive", source: "hive", thumbnail: nil, href: "/map"),
  ]
}

private func samplePayload() -> WidgetPayload {
  WidgetPayload(updatedAt: Date().timeIntervalSince1970,
                userLat: -22.9028, userLng: -43.1731, spots: sampleSpots())
}

struct Provider: TimelineProvider {
  let variant: WidgetVariant

  private func empty(_ payload: WidgetPayload?) -> SpotEntry {
    SpotEntry(date: Date(), payload: payload, snapshot: nil, thumbnails: [], selectedIndex: 0)
  }

  private func sampleEntry() -> SpotEntry {
    SpotEntry(date: Date(), payload: samplePayload(), snapshot: nil, thumbnails: [], selectedIndex: 0)
  }

  // Redacted/loading placeholder — instant, no network. Sample content keeps it
  // from flashing the empty state.
  func placeholder(in context: Context) -> SpotEntry { sampleEntry() }

  func getSnapshot(in context: Context, completion: @escaping (SpotEntry) -> Void) {
    let real = loadPayload()
    if let real = real, !real.spots.isEmpty {
      completion(empty(real)) // real synced data wins (e.g. post-sync snapshot)
      return
    }
    guard context.isPreview else {
      completion(empty(real)) // home-screen transient with no data yet
      return
    }
    // Widget gallery preview, no real data: show rich sample content. For the
    // map variant, render an actual snapshot so the picker shows a real map.
    if variant == .map, let lat = samplePayload().userLat, let lng = samplePayload().userLng {
      let payload = samplePayload()
      Task {
        let snap = await renderMapSnapshot(
          center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
          spots: Array(payload.spots.prefix(12)),
          size: CGSize(width: 380, height: 220)
        )
        completion(SpotEntry(date: Date(), payload: payload, snapshot: snap,
                             thumbnails: [], selectedIndex: 0))
      }
    } else {
      completion(sampleEntry())
    }
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

  /// Download spot photos with limited concurrency (max 2 in flight at once),
  /// preserving order. Each downsampled thumbnail is ~400px, but capping
  /// concurrency keeps peak memory well under the WidgetKit extension's
  /// ~30 MB limit even while a download/decode is briefly in progress.
  private func loadThumbnails(_ spots: [NearbySpot]) async -> [UIImage?] {
    let maxConcurrent = 2
    var result = [UIImage?](repeating: nil, count: spots.count)

    await withTaskGroup(of: (Int, UIImage?).self) { group in
      var nextIndex = 0

      // Prime the group with the first batch.
      while nextIndex < spots.count && nextIndex < maxConcurrent {
        let i = nextIndex
        group.addTask { (i, await loadImage(spots[i].thumbnail)) }
        nextIndex += 1
      }

      // As each task finishes, record its result and start the next one.
      while let (i, img) = await group.next() {
        result[i] = img
        if nextIndex < spots.count {
          let next = nextIndex
          group.addTask { (next, await loadImage(spots[next].thumbnail)) }
          nextIndex += 1
        }
      }
    }

    return result
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

// MARK: - Widget 4: Add Spot (static action tile → opens the camera spot flow)

// No timeline data needed — it's a pure action launcher. A single static entry,
// never refreshed.
struct AddSpotEntry: TimelineEntry { let date: Date }

struct AddSpotProvider: TimelineProvider {
  func placeholder(in context: Context) -> AddSpotEntry { AddSpotEntry(date: Date()) }
  func getSnapshot(in context: Context, completion: @escaping (AddSpotEntry) -> Void) {
    completion(AddSpotEntry(date: Date()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<AddSpotEntry>) -> Void) {
    completion(Timeline(entries: [AddSpotEntry(date: Date())], policy: .never))
  }
}

struct AddSpotWidget: Widget {
  let kind = "AddSpotWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: AddSpotProvider()) { _ in
      AddSpotView()
    }
    .configurationDisplayName("Add Spot")
    .description("Tap to open SkateHive's camera and add a new skate spot.")
    .supportedFamilies([.systemSmall])
    .edgeToEdge()
  }
}

@main
struct SkateSpotsBundle: WidgetBundle {
  var body: some Widget {
    NearestSpotWidget()
    SpotMapWidget()
    TopSpotsWidget()
    AddSpotWidget()
  }
}
