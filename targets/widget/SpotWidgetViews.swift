import SwiftUI
import WidgetKit
import MapKit
import AppIntents

let accent = Color(red: 50 / 255, green: 205 / 255, blue: 50 / 255)

// MARK: - Design system
//
// Native-widget styling: the system's rounded widget container is the ONLY
// frame. No corner brackets, no inner borders, no nested cards. Photos and the
// map bleed to the edges and are clipped by the widget radius itself (the
// configurations opt out of iOS 17 content margins — see index.swift).
// SkateHive identity is carried by the black surface, neon-green accents and
// monospaced type rather than by HUD chrome.

/// Monospaced "terminal" font.
func mono(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
  .system(size: size, weight: weight, design: .monospaced)
}

extension View {
  /// Subtle dark shadow that keeps text legible over photos and the map.
  /// Replaces the old neon glow, which read as game-HUD chrome.
  func legible() -> some View {
    shadow(color: .black.opacity(0.6), radius: 2)
  }

  // iOS 17 requires a declared container background; pre-17 uses a plain one.
  @ViewBuilder
  func widgetBackground(_ bg: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(bg, for: .widget)
    } else {
      self.background(bg)
    }
  }
}

/// Very faint grid texture — brand flavour only, kept far below the old
/// intensity so it reads as surface grain rather than a scanner overlay.
struct HUDGrid: View {
  var step: CGFloat = 22
  var body: some View {
    GeometryReader { geo in
      Path { p in
        var x: CGFloat = step
        while x < geo.size.width {
          p.move(to: CGPoint(x: x, y: 0)); p.addLine(to: CGPoint(x: x, y: geo.size.height)); x += step
        }
        var y: CGFloat = step
        while y < geo.size.height {
          p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: geo.size.width, y: y)); y += step
        }
      }
      .stroke(accent.opacity(0.025), lineWidth: 0.5)
    }
    .allowsHitTesting(false)
  }
}

/// Placeholder art shown when a spot has no photo — a skateboard on the bare
/// black surface. No frame; the surrounding widget radius does the clipping.
struct SkateboardPlaceholder: View {
  var size: CGFloat = 42
  var body: some View {
    ZStack {
      Color(white: 0.07)
      HUDGrid()
      Text("🛹").font(.system(size: size))
    }
  }
}

// MARK: - Nearest Spot (small + medium, cyclable)

struct NearestSpotView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SpotEntry

  var body: some View {
    Group {
      if let payload = entry.payload, !payload.spots.isEmpty {
        let count = min(5, payload.spots.count)
        let idx = min(max(0, entry.selectedIndex), count - 1)
        let spot = payload.spots[idx]
        let img = entry.thumbnails.indices.contains(idx) ? entry.thumbnails[idx] : nil
        if family == .systemSmall {
          SmallView(spot: spot, image: img)
        } else {
          NearestSpotMediumView(spot: spot, image: img, index: idx,
                                count: count, updatedAt: payload.updatedAt)
        }
      } else {
        EmptyStateView()
      }
    }
    .widgetBackground(.black)
  }
}

struct SmallView: View {
  let spot: NearbySpot
  var image: UIImage?

  var body: some View {
    ZStack(alignment: .bottomLeading) {
      if let image = image {
        Image(uiImage: image).resizable().scaledToFill()
      } else {
        SkateboardPlaceholder()
      }
      LinearGradient(colors: [.clear, .black.opacity(0.5), .black.opacity(0.95)],
                     startPoint: .top, endPoint: .bottom)

      VStack(alignment: .leading, spacing: 2) {
        Text("◉ NEAREST").font(mono(9, .bold)).foregroundColor(accent)
        Spacer(minLength: 0)
        Text(spot.name.uppercased())
          .font(mono(13, .bold)).foregroundColor(.white).lineLimit(2)
        if let d = spot.distanceKm {
          Text("▸ \(formatDistance(d))").font(mono(12, .bold)).foregroundColor(accent)
        }
      }
      .legible()
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .padding(13)
    }
    .widgetURL(appURL(spot.href))
  }
}

struct NearestSpotMediumView: View {
  let spot: NearbySpot
  var image: UIImage?
  var index: Int
  var count: Int
  var updatedAt: Double = 0

  var body: some View {
    GeometryReader { geo in
      HStack(spacing: 0) {
        // Left: spot photo (or skateboard art) bled to the edges; a gradient
        // melts it into the black info panel instead of a hard divider.
        ZStack {
          if let image = image {
            Image(uiImage: image).resizable().scaledToFill()
          } else {
            SkateboardPlaceholder(size: 46)
          }
          LinearGradient(colors: [.clear, .black.opacity(0.85)],
                         startPoint: .leading, endPoint: .trailing)
        }
        .frame(width: geo.size.width * 0.42)
        .frame(maxHeight: .infinity)
        .clipped()

        // Right: spot metadata on the black surface.
        VStack(alignment: .leading, spacing: 5) {
          HStack(spacing: 4) {
            Text("◉ NEAREST SPOT").font(mono(9, .bold)).foregroundColor(accent)
            Spacer(minLength: 2)
            Text(syncLabel(updatedAt)).font(mono(8)).foregroundColor(.gray).lineLimit(1)
          }
          Text(spot.name.uppercased())
            .font(mono(16, .bold)).foregroundColor(.white).lineLimit(2)
          if let d = spot.distanceKm {
            Text("▸ \(formatDistance(d))").font(mono(15, .bold)).foregroundColor(accent)
          }
          if let author = spot.author {
            Text("@\(author)").font(mono(11)).foregroundColor(accent.opacity(0.85)).lineLimit(1)
          } else {
            Text("// CURATED").font(mono(10)).foregroundColor(.gray)
          }
          Spacer(minLength: 4)
          HStack {
            Text(String(format: "%02d/%02d", index + 1, count))
              .font(mono(10, .bold)).foregroundColor(.gray)
            Spacer()
            NextArrow()
          }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
      }
    }
    .widgetURL(appURL(spot.href))
  }
}

/// Interactive "next spot" arrow (iOS 17+); a decorative chevron otherwise.
struct NextArrow: View {
  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: NextSpotIntent()) {
        Image(systemName: "chevron.forward")
          .font(.system(size: 13, weight: .heavy))
          .foregroundColor(.black)
          .frame(width: 38, height: 28)
          .background(accent)
          .clipShape(RoundedRectangle(cornerRadius: 9))
      }
      .buttonStyle(.plain)
    } else {
      Image(systemName: "chevron.forward")
        .font(.system(size: 13, weight: .heavy))
        .foregroundColor(accent)
        .frame(width: 38, height: 28)
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(accent, lineWidth: 1))
    }
  }
}

// MARK: - Spot Map (medium / large): map left, nearest list right

struct SpotMapView: View {
  @Environment(\.widgetFamily) private var family
  let entry: SpotEntry

  var body: some View {
    Group {
      if let payload = entry.payload, !payload.spots.isEmpty {
        MapListView(payload: payload, snapshot: entry.snapshot, large: family == .systemLarge)
      } else {
        EmptyStateView()
      }
    }
    .widgetBackground(.black)
  }
}

struct MapListView: View {
  let payload: WidgetPayload
  let snapshot: UIImage?
  let large: Bool

  var body: some View {
    VStack(spacing: 0) {
      // Map on top, bled to the edges and clipped by the widget radius — no
      // container, no border. A top gradient keeps the labels legible.
      ZStack(alignment: .top) {
        mapSection
          .frame(maxWidth: .infinity)
          .frame(height: large ? 192 : 102)
          .clipped()
        LinearGradient(colors: [.black.opacity(0.45), .clear],
                       startPoint: .top, endPoint: .center)
          .frame(height: large ? 192 : 102)
          .allowsHitTesting(false)
        HStack {
          Text("◉ SPOT MAP").font(mono(9, .bold)).foregroundColor(accent)
          Spacer()
          Text(syncLabel(payload.updatedAt)).font(mono(8, .bold)).foregroundColor(.white)
        }
        .legible()
        .padding(10)
      }
      // List across the full width below — names get the room they need.
      listSection
    }
    .widgetURL(appURL("/map"))
  }

  @ViewBuilder
  private var mapSection: some View {
    if let img = snapshot {
      Image(uiImage: img).resizable().aspectRatio(contentMode: .fill)
    } else {
      SkateboardPlaceholder(size: 30)
    }
  }

  private var listSection: some View {
    let items = Array(payload.spots.prefix(large ? 4 : 2))
    return VStack(spacing: 0) {
      ForEach(Array(items.enumerated()), id: \.element.id) { i, spot in
        Link(destination: appURL(spot.href) ?? appURL("/map")!) {
          HStack(spacing: 8) {
            Text("›").font(mono(13, .bold)).foregroundColor(accent)
            Text(spot.name.uppercased())
              .font(mono(large ? 13 : 11, .semibold)).foregroundColor(.white).lineLimit(1)
            Spacer(minLength: 6)
            if let d = spot.distanceKm {
              Text(formatDistance(d)).font(mono(large ? 13 : 11, .bold)).foregroundColor(accent)
            }
          }
        }
        if i < items.count - 1 { Spacer(minLength: 0) }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .padding(.horizontal, 14)
    .padding(.vertical, large ? 14 : 10)
  }
}

// MARK: - Top Spots (2x2 photo grid), equal-size photos

struct TopSpotsView: View {
  let entry: SpotEntry

  var body: some View {
    Group {
      if let payload = entry.payload, !payload.spots.isEmpty {
        let spots = Array(payload.spots.prefix(4))
        // Thin black seams between tiles; the widget radius rounds the outer
        // corners. No per-tile rounding — the grid feels carved from the widget.
        VStack(spacing: 2) {
          HStack(spacing: 2) { card(spots, 0); card(spots, 1) }
          HStack(spacing: 2) { card(spots, 2); card(spots, 3) }
        }
      } else {
        EmptyStateView()
      }
    }
    .widgetBackground(.black)
  }

  @ViewBuilder
  private func card(_ spots: [NearbySpot], _ i: Int) -> some View {
    if spots.indices.contains(i) {
      SpotPhotoCard(spot: spots[i],
                    image: entry.thumbnails.indices.contains(i) ? entry.thumbnails[i] : nil)
    } else {
      Color.clear
    }
  }
}

// A single equal-size, tappable spot photo. `Color.clear` as the base keeps every
// card the same size in a stack regardless of whether its image loaded; the
// rectangular clip keeps images inside their cell so the seams stay crisp.
struct SpotPhotoCard: View {
  let spot: NearbySpot
  var image: UIImage?

  var body: some View {
    Link(destination: appURL(spot.href) ?? appURL("/map")!) {
      Color.clear
        .overlay(
          Group {
            if let image = image {
              Image(uiImage: image).resizable().scaledToFill()
            } else {
              SkateboardPlaceholder(size: 26)
            }
          }
        )
        .overlay(
          LinearGradient(colors: [.clear, .black.opacity(0.85)],
                         startPoint: .center, endPoint: .bottom)
        )
        .overlay(alignment: .bottomLeading) {
          VStack(alignment: .leading, spacing: 1) {
            Text(spot.name.uppercased())
              .font(mono(10, .bold)).foregroundColor(.white).lineLimit(2)
            if let d = spot.distanceKm {
              Text("▸ \(formatDistance(d))").font(mono(9, .bold)).foregroundColor(accent)
            }
          }
          .legible()
          .padding(8)
        }
        .clipped()
        .contentShape(Rectangle())
    }
  }
}

// MARK: - Empty state (no location pushed yet)

struct EmptyStateView: View {
  var body: some View {
    ZStack {
      HUDGrid()
      VStack(spacing: 8) {
        Text("◉").font(mono(22, .bold)).foregroundColor(accent)
        Text("NO SIGNAL").font(mono(13, .bold)).foregroundColor(.white)
        Text("// OPEN SKATEHIVE TO\nLOCATE NEARBY SPOTS")
          .font(mono(9)).foregroundColor(.gray).multilineTextAlignment(.center)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .widgetURL(appURL("/map"))
  }
}
