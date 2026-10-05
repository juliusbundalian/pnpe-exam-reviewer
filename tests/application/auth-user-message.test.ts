import { AppError } from '../../src/core/errors/AppError';
import { toFriendlyAuthMessage } from '../../src/core/errors/userMessage';
test.each([
  new Error('SDK credentials stack'),
  { code: 'network', userMessage: 'raw SDK' },
  null,
  'SDK',
  new AppError('invalid-config'),
])('unknown error %p uses a safe generic message', (error) => {
  expect(toFriendlyAuthMessage(error)).toBe('Something went wrong. Please try again.');
});
test('mapped AppError ignores a mutated message and returns approved message', () => {
  const error = new AppError('network');
  error.message = 'unsafe SDK';
  Object.defineProperty(error, 'userMessage', { value: 'unsafe SDK' });
  expect(toFriendlyAuthMessage(error)).toBe('Please check your connection and try again.');
});
