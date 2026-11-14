Pod::Spec.new do |s|
  s.name           = 'WorkoutLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Active-workout Live Activity (iOS) and ongoing notification (Android)'
  s.description    = 'Local Expo module: starts, updates and ends the workout Live Activity.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { type: 'UNLICENSED' }
  # The app's minimum stays 15.1; ActivityKit calls are gated with @available(iOS 16.2, *).
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # ActivityKit doesn't exist on iOS 15: weak-link it so the app still launches there.
  s.weak_frameworks = 'ActivityKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
