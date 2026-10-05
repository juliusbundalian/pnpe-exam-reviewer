import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function selectConfig(files: boolean) {
  const result = execFileSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      `const config = require('./app.config.ts').default; console.log(JSON.stringify({ plugins:config.plugins, firebase:config.extra.firebase, iosFile:!!config.ios.googleServicesFile, androidFile:!!config.android.googleServicesFile }));`,
    ],
    {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        GOOGLE_SERVICES_IOS: files ? './package.json' : '/nonexistent/pnpe/ios.plist',
        GOOGLE_SERVICES_ANDROID: files ? './package.json' : '/nonexistent/pnpe/android.json',
        EXPO_PUBLIC_FIREBASE_MODE: 'emulator',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-pnpe',
        EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      },
    },
  );
  return JSON.parse(result) as {
    plugins: (string | [string, unknown])[];
    firebase: { mode: string };
    iosFile: boolean;
    androidFile: boolean;
  };
}
test('unconfigured native build omits configure/copy plugins while configured build enables them', () => {
  const missing = selectConfig(false);
  expect(missing.firebase.mode).toBe('unconfigured');
  expect(missing.iosFile).toBe(false);
  expect(missing.androidFile).toBe(false);
  expect(
    missing.plugins.map((value) => (typeof value === 'string' ? value : value[0])),
  ).not.toContain('@react-native-firebase/app');
  const configured = selectConfig(true);
  expect(configured.firebase.mode).toBe('emulator');
  expect(configured.iosFile && configured.androidFile).toBe(true);
  expect(configured.plugins).toContainEqual([
    '@react-native-firebase/app',
    { ios: { disableSPM: true } },
  ]);
});
test('pinned CocoaPods helper transformation sets the Ruby flag once before targets', () => {
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `const plugin = require('./plugins/withFirebaseCocoaPods.cjs'); const config=plugin({name:'test',slug:'test'}); const input = "def prepare_react_native_project!; end\\nprepare_react_native_project!\\nputs defined?($RNFirebaseDisableSPM) && $RNFirebaseDisableSPM\\n"; const run = async contents => (await config.mods.ios.podfile({...config,modRequest:{},modResults:{contents}})).modResults.contents; (async()=>{const once=await run(input); const twice=await run(once); if(once!==twice) process.exit(1); process.stdout.write(twice);})();`,
    ],
    { encoding: 'utf8' },
  );
  expect(execFileSync('ruby', ['-e', output], { encoding: 'utf8' }).trim()).toBe('true');
});

test('lint permits central bootstrap imports and rejects raw SDK static and dynamic imports in presentation', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { ESLint } from 'eslint'; const eslint=new ESLint(); const samples=[['src/bootstrap/example.ts', "import '../core/firebase/native';"], ['src/features/home/presentation/example.ts', "import '@react-native-firebase/auth';"], ['src/features/home/presentation/example.ts', "void import('@react-native-firebase/auth');"], ['src/core/firebase/example.ts', "void import('firebase-admin/auth');"]]; const results=await Promise.all(samples.map(async ([filePath,code]) => (await eslint.lintText(code,{filePath}))[0].errorCount)); console.log(JSON.stringify(results));`,
    ],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(result)).toEqual([0, 1, 1, 1]);
});
