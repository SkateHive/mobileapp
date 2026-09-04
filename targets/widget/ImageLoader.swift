import UIKit
import ImageIO
import CryptoKit

// WidgetKit extensions are capped at roughly 30 MB of memory. Spot photos come
// in large (Google My Maps PNGs ~2048x1536 / ~12.6 MB decoded, Hive JPEGs
// ~1824x1368 / ~10 MB decoded), and the "nearest" widget loads up to 5 of them
// in parallel — a naive `UIImage(data:)` decode of the full-size files can
// exceed the memory limit on its own and gets the extension killed, which is
// why photos sometimes go missing on the Home Screen. The views only ever
// render these thumbnails in frames of ~200pt or less (see SpotWidgetViews.swift),
// so we downsample with ImageIO at decode time instead of decoding full-size
// and scaling down afterward — ImageIO never materializes the full bitmap.
// A small on-disk cache (in the shared App Group container) avoids re-downloading
// and re-decoding the same photo on every timeline refresh.

private let thumbnailMaxPixelSize = 400
private let thumbnailCacheDirectoryName = "widget-thumbs"

private func thumbnailCacheDirectory() -> URL? {
  guard
    let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroupId)
  else { return nil }
  let dir = container
    .appendingPathComponent("Caches", isDirectory: true)
    .appendingPathComponent(thumbnailCacheDirectoryName, isDirectory: true)
  try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return dir
}

private func cacheFileURL(for urlString: String) -> URL? {
  guard let dir = thumbnailCacheDirectory() else { return nil }
  let digest = SHA256.hash(data: Data(urlString.utf8))
  let hex = digest.map { String(format: "%02x", $0) }.joined()
  return dir.appendingPathComponent("\(hex).jpg")
}

/// Downsamples image data to a UIImage no larger than `maxPixelSize` on its
/// longest side, without ever decoding the full-size bitmap into memory.
private func downsample(_ data: Data, maxPixelSize: Int = thumbnailMaxPixelSize) -> UIImage? {
  let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
  guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions as CFDictionary)
  else { return nil }

  let thumbnailOptions: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceShouldCacheImmediately: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
  ]
  guard
    let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions as CFDictionary)
  else { return nil }

  return UIImage(cgImage: cgImage)
}

/// Downloads a remote image for the widget. WidgetKit views can't fetch images
/// themselves, so this runs in the TimelineProvider and the result is passed
/// into the entry as a UIImage. Returns nil on any failure (view falls back to 🛹).
func loadImage(_ urlString: String?) async -> UIImage? {
  guard
    let urlString = urlString,
    let url = URL(string: urlString),
    url.scheme == "https" || url.scheme == "http"
  else { return nil }

  let cacheURL = cacheFileURL(for: urlString)

  // Serve from the App Group disk cache when available — cache errors are
  // ignored, we just fall through to a fresh download.
  if let cacheURL, let cached = try? Data(contentsOf: cacheURL), let image = UIImage(data: cached) {
    return image
  }

  var request = URLRequest(url: url)
  request.timeoutInterval = 8

  do {
    let (data, _) = try await URLSession.shared.data(for: request)
    guard let image = downsample(data) else { return nil }

    if let cacheURL, let jpeg = image.jpegData(compressionQuality: 0.8) {
      try? jpeg.write(to: cacheURL, options: .atomic)
    }

    return image
  } catch {
    return nil
  }
}
