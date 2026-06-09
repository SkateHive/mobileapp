Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Writes nearby skate spots to the shared App Group and reloads the iOS widget.'
  s.description    = 'Local Expo module bridging RN to the App Group UserDefaults consumed by the SkateSpots widget.'
  s.author         = 'SkateHive'
  s.homepage       = 'https://skatehive.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.4'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
