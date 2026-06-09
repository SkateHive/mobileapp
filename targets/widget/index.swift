import WidgetKit
import SwiftUI
import MapKit

struct SpotEntry: TimelineEntry {
  let date: Date
  let payload: WidgetPayload?
  let snapshot: UIImage?    // pre-rendered map; only the map widget needs it
  let thumbnail: UIImage?   // nearest spot's photo; only the nearest widget needs it
}

/// Shared provider for both widgets. `rendersMap` controls whether we pay the
/// MKMapSnapshotter cost — the Nearest Spot widget doesn't show a map.
struct Provider: TimelineProvider {
  let rendersMap: Bool

  func placeholder(in context: Context) -> SpotEntry {
    SpotEntry(date: Date(), payload: nil, snapshot: nil, thumbnail: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (SpotEntry) -> Void) {
    completion(SpotEntry(date: Date(), payload: loadPayload(), snapshot: nil, thumbnail: nil))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SpotEntry>) -> Void) {
    let payload = loadPayload()
    // Re-read roughly hourly; the app also force-reloads on foreground via WidgetBridge.
    let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: Date())
      ?? Date().addingTimeInterval(3600)

    guard let payload = payload, !payload.spots.isEmpty else {
      completion(Timeline(entries: [SpotEntry(date: Date(), payload: payload, snapshot: nil, thumbnail: nil)],
                          policy: .after(nextUpdate)))
      return
    }

    Task {
      // Map widget: pre-render the map (WidgetKit can't host a live MapKit view).
      var snapshot: UIImage?
      if rendersMap, let lat = payload.userLat, let lng = payload.userLng {
        snapshot = await renderMapSnapshot(
          center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
          spots: Array(payload.spots.prefix(12)),
          size: CGSize(width: 360, height: 200)
        )
      }
      // Nearest Spot widget: download the closest spot's photo.
      var thumbnail: UIImage?
      if !rendersMap {
        thumbnail = await loadImage(payload.spots.first?.thumbnail)
      }
      completion(Timeline(entries: [SpotEntry(date: Date(), payload: payload,
                                              snapshot: snapshot, thumbnail: thumbnail)],
                          policy: .after(nextUpdate)))
    }
  }
}

// MARK: - Widget 1: the single nearest spot

struct NearestSpotWidget: Widget {
  let kind = "NearestSpotWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider(rendersMap: false)) { entry in
      NearestSpotView(entry: entry)
    }
    .configurationDisplayName("Nearest Spot")
    .description("The skate spot closest to you.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// MARK: - Widget 2: the spot map + nearest list

struct SpotMapWidget: Widget {
  let kind = "SpotMapWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider(rendersMap: true)) { entry in
      SpotMapView(entry: entry)
    }
    .configurationDisplayName("Spot Map")
    .description("A map of skate spots near you.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

@main
struct SkateSpotsBundle: WidgetBundle {
  var body: some Widget {
    NearestSpotWidget()
    SpotMapWidget()
  }
}
