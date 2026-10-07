import Constants from 'expo-constants';
import { startBlock } from '../../src/navigation/startAvailability';
import { defaults } from '../../src/core/config/defaults';
import { parseParameter } from '../../src/core/config/schemas';
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '0.1.0' } },
}));
afterEach(() => {
  Constants.expoConfig!.version = '0.1.0';
});
test.each([
  ['0.1.0', '0.1.1+build.123', true],
  ['0.1.0+installed.99', '0.1.0+build.123', false],
  ['0.1.0', '0.1.0-rc.1', false],
  ['0.1.0-rc.1', '0.1.0', true],
  ['0.1.0-rc.2', '0.1.0-rc.10', true],
  ['0.1.0-alpha.10', '0.1.0-alpha.2', false],
  ['0.1.0-alpha', '0.1.0-alpha.1', true],
  ['0.1.0-1', '0.1.0-alpha', true],
  ['0.1.0-beta', '0.1.0-alpha', false],
  ['1.0.0', '0.1.1', false],
])('app-config version %s compares minimum %s with blocked=%s', (installed, minimum, blocked) => {
  Constants.expoConfig!.version = installed;
  const info = parseParameter(
    'app_info',
    JSON.stringify({ ...defaults.app_info, minimumSupportedVersion: minimum }),
  );
  expect(startBlock(info) !== null).toBe(blocked);
});
