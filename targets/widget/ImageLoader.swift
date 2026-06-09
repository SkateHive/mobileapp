import UIKit

/// Downloads a remote image for the widget. WidgetKit views can't fetch images
/// themselves, so this runs in the TimelineProvider and the result is passed
/// into the entry as a UIImage. Returns nil on any failure (view falls back to 🛹).
func loadImage(_ urlString: String?) async -> UIImage? {
  guard
    let urlString = urlString,
    let url = URL(string: urlString),
    url.scheme == "https" || url.scheme == "http"
  else { return nil }

  do {
    let (data, _) = try await URLSession.shared.data(from: url)
    return UIImage(data: data)
  } catch {
    return nil
  }
}
