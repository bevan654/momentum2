/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'WorkoutActivity',
  bundleIdentifier: '.WorkoutActivity',
  // ActivityKit's ActivityContent API needs 16.2; the app itself stays on 15.1.
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'ActivityKit', 'WidgetKit'],
};
