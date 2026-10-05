// Pinned RNFirebase 26.4 helper: only select CocoaPods; do not configure an app
// without its native service files. Recheck this internal path on RNFB upgrades.
const path = require('node:path');
const packageRoot = path.dirname(require.resolve('@react-native-firebase/app/package.json'));
const { withIosDisableSPM } = require(path.join(packageRoot, 'plugin/build/ios/podfile.js'));
module.exports = (config) => withIosDisableSPM(config, { ios: { disableSPM: true } });
