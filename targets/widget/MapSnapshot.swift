import MapKit
import UIKit

/// Renders a static dark-mode map image with spot + user-location pins. The
/// Spot Map widget shows this image in its left panel (WidgetKit can't host a
/// live SwiftUI `Map` inside a widget), filled and clipped by the panel.
func renderMapSnapshot(
  center: CLLocationCoordinate2D,
  spots: [NearbySpot],
  size: CGSize
) async -> UIImage? {
  guard size.width > 0, size.height > 0 else { return nil }

  // Fit center + all spots with a little padding; clamp to a sane minimum span.
  var minLat = center.latitude, maxLat = center.latitude
  var minLng = center.longitude, maxLng = center.longitude
  for s in spots {
    minLat = min(minLat, s.lat); maxLat = max(maxLat, s.lat)
    minLng = min(minLng, s.lng); maxLng = max(maxLng, s.lng)
  }
  let spanLat = max((maxLat - minLat) * 1.4, 0.02)
  let spanLng = max((maxLng - minLng) * 1.4, 0.02)
  let region = MKCoordinateRegion(
    center: CLLocationCoordinate2D(
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2
    ),
    span: MKCoordinateSpan(latitudeDelta: spanLat, longitudeDelta: spanLng)
  )

  let options = MKMapSnapshotter.Options()
  options.region = region
  options.size = size
  options.traitCollection = UITraitCollection(userInterfaceStyle: .dark)

  let snapshotter = MKMapSnapshotter(options: options)
  guard let snapshot = try? await snapshotter.start() else { return nil }

  let renderer = UIGraphicsImageRenderer(size: size)
  return renderer.image { _ in
    snapshot.image.draw(at: .zero)
    let green = UIColor(red: 50 / 255, green: 205 / 255, blue: 50 / 255, alpha: 1)

    for s in spots {
      let pt = snapshot.point(for: CLLocationCoordinate2D(latitude: s.lat, longitude: s.lng))
      let d: CGFloat = 11
      let dot = UIBezierPath(ovalIn: CGRect(x: pt.x - d / 2, y: pt.y - d / 2, width: d, height: d))
      green.setFill(); dot.fill()
      UIColor.black.setStroke(); dot.lineWidth = 2; dot.stroke()
    }

    // User location dot.
    let upt = snapshot.point(for: center)
    let u: CGFloat = 10
    let uDot = UIBezierPath(ovalIn: CGRect(x: upt.x - u / 2, y: upt.y - u / 2, width: u, height: u))
    UIColor.systemBlue.setFill(); uDot.fill()
    UIColor.white.setStroke(); uDot.lineWidth = 2; uDot.stroke()
  }
}
