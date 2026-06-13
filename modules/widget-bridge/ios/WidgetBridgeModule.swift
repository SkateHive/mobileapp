import ExpoModulesCore
import WidgetKit

// Writes the nearby-spots payload from the RN app into the shared App Group so
// the SkateSpots widget can read it, then forces a timeline reload.
public class WidgetBridgeModule: Module {
  private let appGroupId = "group.com.bgrana.skatehive"
  private let payloadKey = "nearbySpotsV1"

  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    Function("setNearbySpots") { (json: String) in
      let defaults = UserDefaults(suiteName: self.appGroupId)
      defaults?.set(json, forKey: self.payloadKey)
      // New data → reset the Nearest Spot widget's cycle back to the closest spot.
      defaults?.set(0, forKey: "selectedSpotIndexV1")
      self.reloadWidgets()
    }

    Function("clear") {
      UserDefaults(suiteName: self.appGroupId)?.removeObject(forKey: self.payloadKey)
      self.reloadWidgets()
    }
  }

  private func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
