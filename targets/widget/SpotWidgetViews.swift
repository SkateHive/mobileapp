import SwiftUI
import WidgetKit
import MapKit

private let accent = Color(red: 50 / 255, green: 205 / 255, blue: 50 / 255)

// iOS 17 requires widgets to declare a container background; pre-17 we just use
// a plain background. This keeps one call site for both.
extension View {
  @ViewBuilder
  func widgetBackground(_ bg: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(bg, for: .widget)
    } else {
      self.background(bg)
    }
  }
}

// Nearest Spot widget — small = compact; medium = richer card.
struct NearestSpotView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SpotEntry

  var body: some View {
    Group {
      if let nearest = entry.payload?.spots.first {
        if family == .systemSmall {
          SmallView(spot: nearest, image: entry.thumbnail)
        } else {
          NearestSpotMediumView(spot: nearest, image: entry.thumbnail)
        }
      } else {
        EmptyStateView()
      }
    }
    .widgetBackground(.black)
  }
}

// Spot Map widget — medium/large map + nearest list.
struct SpotMapView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SpotEntry

  var body: some View {
    Group {
      if let payload = entry.payload, !payload.spots.isEmpty {
        MapListView(payload: payload, snapshot: entry.snapshot,
                    large: family == .systemLarge)
      } else {
        EmptyStateView()
      }
    }
    .widgetBackground(.black)
  }
}

// MARK: - Small: the single nearest spot

struct SmallView: View {
  let spot: NearbySpot
  var image: UIImage? = nil

  var body: some View {
    Group {
      if let image = image {
        // Photo fills the tile with a dark gradient so the text stays legible.
        ZStack(alignment: .bottomLeading) {
          Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
          LinearGradient(
            colors: [.clear, .black.opacity(0.25), .black.opacity(0.9)],
            startPoint: .top, endPoint: .bottom
          )
          labels
            .padding(12)
        }
      } else {
        VStack(alignment: .leading, spacing: 4) {
          Text("🛹").font(.system(size: 26))
          Spacer(minLength: 0)
          labels
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(12)
      }
    }
    .widgetURL(appURL(spot.href))
  }

  private var labels: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(spot.name)
        .font(.system(size: 14, weight: .bold))
        .foregroundColor(.white)
        .lineLimit(2)
      if let d = spot.distanceKm {
        Text(formatDistance(d))
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(accent)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Nearest Spot, medium: a richer single-spot card

struct NearestSpotMediumView: View {
  let spot: NearbySpot
  var image: UIImage? = nil

  var body: some View {
    HStack(spacing: 14) {
      ZStack {
        RoundedRectangle(cornerRadius: 12).fill(Color(white: 0.12))
        if let image = image {
          Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        } else {
          Text("🛹").font(.system(size: 34))
        }
      }
      .frame(width: 80, height: 80)

      VStack(alignment: .leading, spacing: 5) {
        Text("NEAREST SPOT")
          .font(.system(size: 10, weight: .bold))
          .foregroundColor(.gray)
          .tracking(1)
        Text(spot.name)
          .font(.system(size: 17, weight: .bold))
          .foregroundColor(.white)
          .lineLimit(2)
        if let d = spot.distanceKm {
          Text("📍 \(formatDistance(d))")
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(accent)
        }
        if let author = spot.author {
          Text("@\(author)").font(.system(size: 12)).foregroundColor(accent).lineLimit(1)
        } else {
          Text("Curated").font(.system(size: 11)).foregroundColor(.gray)
        }
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(14)
    .widgetURL(appURL(spot.href))
  }
}

// MARK: - Medium / Large: map + nearest list

struct MapListView: View {
  let payload: WidgetPayload
  let snapshot: UIImage?
  let large: Bool

  var body: some View {
    VStack(spacing: 0) {
      mapSection
        .frame(maxWidth: .infinity)
        .frame(height: large ? 190 : 108)
        .clipped()
      listSection
    }
    // Tapping the map area opens the full in-app map.
    .widgetURL(appURL("/map"))
  }

  @ViewBuilder
  private var mapSection: some View {
    if let img = snapshot {
      Image(uiImage: img)
        .resizable()
        .aspectRatio(contentMode: .fill)
    } else {
      ZStack {
        Color(white: 0.1)
        Text("🛹").font(.system(size: 30))
      }
    }
  }

  private var listSection: some View {
    VStack(spacing: 6) {
      ForEach(payload.spots.prefix(large ? 4 : 2)) { spot in
        Link(destination: appURL(spot.href) ?? appURL("/map")!) {
          HStack(spacing: 6) {
            Text("🛹").font(.system(size: 12))
            Text(spot.name)
              .font(.system(size: 12, weight: .semibold))
              .foregroundColor(.white)
              .lineLimit(1)
            Spacer(minLength: 4)
            if let d = spot.distanceKm {
              Text(formatDistance(d))
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(accent)
            }
          }
        }
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

// MARK: - Empty state (no location pushed yet)

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 8) {
      Text("🛹").font(.system(size: 30))
      Text("Open SkateHive to find\nspots near you")
        .font(.system(size: 12, weight: .medium))
        .foregroundColor(.gray)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(12)
    .widgetURL(appURL("/map"))
  }
}
