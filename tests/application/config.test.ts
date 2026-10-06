import { ConfigRepository } from '../../src/core/config/ConfigRepository';
import { defaults } from '../../src/core/config/defaults';
import { isAnnouncementVisible, parseParameter } from '../../src/core/config/schemas';
import { AppError } from '../../src/core/errors/AppError';
import { MemoryKeyValueStore, StubRemoteConfigService } from '../fixtures/config';

test.each([true, false])(
  'delayed cache respects valid remote freshness=%s per parameter',
  async (valid) => {
    let finish!: (value: string | null) => void;
    const pending = new Promise<string | null>((resolve) => {
      finish = resolve;
    });
    const storage = new MemoryKeyValueStore();
    storage.get = (key) => (key === 'remote-config:app_info' ? pending : Promise.resolve(null));
    const remote = new StubRemoteConfigService();
    remote.parameters.app_info = valid
      ? JSON.stringify({ ...defaults.app_info, appName: 'Fresh remote' })
      : 'invalid';
    const repo = new ConfigRepository(remote, storage);
    const cacheRead = repo.loadCached();
    await repo.refresh();
    finish(
      JSON.stringify({
        schemaVersion: 1,
        validatedAt: '2026-10-04T00:00:00Z',
        value: { ...defaults.app_info, appName: 'Saved cache' },
      }),
    );
    await cacheRead;
    expect(repo.get('app_info').appName).toBe(valid ? 'Fresh remote' : 'Saved cache');
  },
);

test('a valid near-limit parameter remains readable after cache envelope overhead', async () => {
  const remote = new StubRemoteConfigService();
  const storage = new MemoryKeyValueStore();
  remote.parameters.data = JSON.stringify({
    ...defaults.data,
    studyTips: Array.from({ length: 26 }, (_, i) => ({
      id: String(i),
      title: 't',
      body: 'x'.repeat(10000),
    })),
  });
  const value = JSON.parse(remote.parameters.data) as {
    studyTips: { id: string; title: string; body: string }[];
  };
  value.studyTips.push({ id: 'tail', title: 't', body: 'x' });
  value.studyTips[26]!.body = 'x'.repeat(262140 - JSON.stringify(value).length + 1);
  remote.parameters.data = JSON.stringify(value);
  await new ConfigRepository(remote, storage).refresh();
  const restarted = new ConfigRepository(remote, storage);
  await restarted.loadCached();
  expect(restarted.get('data').studyTips).toHaveLength(27);
});

test.each([
  { durationMinutes: 0 },
  { durationMinutes: 1441 },
  { durationMinutes: 1.5 },
  { passingPercentage: -1 },
  { passingPercentage: 101 },
  {
    distribution: {
      generalInformation: 0,
      communicationSkills: 40,
      quantitativeReasoning: 25,
      criticalThinking: 85,
    },
  },
  { distribution: { communicationSkills: 40, quantitativeReasoning: 25, criticalThinking: 85 } },
])('rejects invalid exam boundaries %j', (fields) => {
  expect(() =>
    parseParameter(
      'config',
      JSON.stringify({ ...defaults.config, mockExam: { ...defaults.config.mockExam, ...fields } }),
    ),
  ).toThrow(AppError);
});

test('all app information fields validate without exposing raw payload errors', () => {
  expect(
    parseParameter(
      'app_info',
      JSON.stringify({
        ...defaults.app_info,
        latestVersion: '1.2.3-rc.1+build.4',
        supportEmail: 'support@example.com',
        privacyPolicyUrl: 'https://example.com/privacy',
      }),
    ).supportEmail,
  ).toBe('support@example.com');
  for (const fields of [
    { latestVersion: '01.0.0' },
    { supportEmail: 'bad' },
    { maintenanceMode: 'sometimes' },
  ]) {
    try {
      parseParameter('app_info', JSON.stringify({ ...defaults.app_info, ...fields }));
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('invalid-config');
      expect((error as AppError).message).not.toContain('sometimes');
    }
  }
});

test('default allocation is coherent and Reviewer has no cap or answer switch', () => {
  const config = parseParameter('config', JSON.stringify(defaults.config));
  expect(config.mockExam).toMatchObject({
    durationMinutes: 180,
    questionCount: 150,
    passingPercentage: 75,
    shuffleQuestions: true,
    shuffleAnswers: true,
    distribution: {
      generalInformation: 35,
      communicationSkills: 40,
      quantitativeReasoning: 25,
      criticalThinking: 50,
    },
  });
  expect(config.reviewer).toEqual({ shuffleQuestions: true });
});

test('incoherent exam JSON is rejected as a whole with a safe error', () => {
  const bad = structuredClone(defaults.config);
  bad.mockExam.distribution.generalInformation = 34;
  expect(() => parseParameter('config', JSON.stringify(bad))).toThrow(AppError);
});

test.each([0, -1, 1001, 1.5])('rejects invalid count %s', (questionCount) => {
  expect(() =>
    parseParameter(
      'config',
      JSON.stringify({
        ...defaults.config,
        mockExam: { ...defaults.config.mockExam, questionCount },
      }),
    ),
  ).toThrow(AppError);
});

test('valid data updates independently while malformed config preserves last good config', async () => {
  const remote = new StubRemoteConfigService();
  const repo = new ConfigRepository(remote, new MemoryKeyValueStore());
  remote.parameters.config = JSON.stringify({
    ...defaults.config,
    reviewer: { shuffleQuestions: false },
  });
  await repo.refresh();
  remote.parameters.config = '{';
  remote.parameters.data = JSON.stringify({
    ...defaults.data,
    studyTips: [{ id: 'tip', title: 'Read', body: 'Read daily.' }],
  });
  await repo.refresh();
  expect(repo.get('config').reviewer.shuffleQuestions).toBe(false);
  expect(repo.get('data').studyTips[0]?.title).toBe('Read');
});

test.each([
  '{',
  JSON.stringify({ schemaVersion: 999, validatedAt: '2026-10-04T00:00:00Z', value: {} }),
  JSON.stringify({ schemaVersion: 1, validatedAt: 'invalid', value: {} }),
])('invalid cache safely uses defaults: %s', async (raw) => {
  const storage = new MemoryKeyValueStore();
  storage.values.set('remote-config:config', raw);
  const repo = new ConfigRepository(new StubRemoteConfigService(), storage);
  await repo.loadCached();
  expect(repo.get('config').mockExam.questionCount).toBe(150);
});

test('validated cache survives restart and ignores invalid values', async () => {
  const storage = new MemoryKeyValueStore();
  const remote = new StubRemoteConfigService();
  remote.parameters.config = JSON.stringify({
    ...defaults.config,
    reviewer: { shuffleQuestions: false },
  });
  await new ConfigRepository(remote, storage).refresh();
  const restarted = new ConfigRepository(remote, storage);
  await restarted.loadCached();
  expect(restarted.get('config').reviewer.shuffleQuestions).toBe(false);
  storage.values.set(
    'remote-config:config',
    JSON.stringify({ schemaVersion: 1, validatedAt: '2026-10-04T00:00:00Z', value: {} }),
  );
  await restarted.loadCached();
  expect(restarted.get('config').reviewer.shuffleQuestions).toBe(false);
});

test('storage and network failures preserve usable values and notify successful memory updates', async () => {
  const storage = new MemoryKeyValueStore();
  storage.failWrites = true;
  storage.failReads = true;
  const remote = new StubRemoteConfigService();
  const repo = new ConfigRepository(remote, storage);
  let updates = 0;
  const unsubscribe = repo.subscribe(() => {
    updates += 1;
  });
  await repo.loadCached();
  remote.parameters.config = JSON.stringify({
    ...defaults.config,
    reviewer: { shuffleQuestions: false },
  });
  await expect(repo.refresh()).resolves.toBeUndefined();
  expect(repo.get('config').reviewer.shuffleQuestions).toBe(false);
  expect(updates).toBeGreaterThan(0);
  unsubscribe();
  const before = updates;
  remote.parameters.config = JSON.stringify(defaults.config);
  await repo.refresh();
  expect(repo.get('config').reviewer.shuffleQuestions).toBe(true);
  expect(updates).toBe(before);
  remote.failFetch = true;
  await repo.refresh();
  expect(updates).toBe(before);
});

test('announcements have unique IDs and valid chronological dates and expire visibly', () => {
  const announcement = {
    id: 'notice',
    title: 'Notice',
    body: 'Text',
    publishedAt: '2026-10-01T00:00:00Z',
    expiresAt: '2026-10-03T00:00:00Z',
  };
  expect(isAnnouncementVisible(announcement, new Date('2026-10-02T00:00:00Z'))).toBe(true);
  expect(isAnnouncementVisible(announcement, new Date('2026-10-03T00:00:00Z'))).toBe(false);
  expect(isAnnouncementVisible(announcement, new Date('2026-09-30T00:00:00Z'))).toBe(false);
  expect(() =>
    parseParameter(
      'data',
      JSON.stringify({ ...defaults.data, announcements: [announcement, announcement] }),
    ),
  ).toThrow(AppError);
  expect(() =>
    parseParameter(
      'data',
      JSON.stringify({
        ...defaults.data,
        announcements: [{ ...announcement, expiresAt: '2026-09-01T00:00:00Z' }],
      }),
    ),
  ).toThrow(AppError);
});

test.each(['http://example.com', 'javascript:alert(1)'])(
  'unsafe URL %s is rejected',
  (privacyPolicyUrl) => {
    expect(() =>
      parseParameter('app_info', JSON.stringify({ ...defaults.app_info, privacyPolicyUrl })),
    ).toThrow(AppError);
  },
);

test('rejects oversized UTF-8 payloads before parsing, bounded text and arrays', () => {
  expect(() => parseParameter('data', 'é'.repeat(131073))).toThrow(AppError);
  expect(() =>
    parseParameter(
      'data',
      JSON.stringify({
        ...defaults.data,
        faq: [{ id: 'a', question: 'x'.repeat(301), answer: 'a' }],
      }),
    ),
  ).toThrow(AppError);
  expect(() =>
    parseParameter(
      'data',
      JSON.stringify({
        ...defaults.data,
        studyTips: Array.from({ length: 101 }, (_, i) => ({
          id: String(i),
          title: 'a',
          body: 'b',
        })),
      }),
    ),
  ).toThrow(AppError);
});

test('valid multibyte JSON is bounded by UTF-8 bytes rather than character count', () => {
  const payload = (character: string) =>
    JSON.stringify({
      ...defaults.data,
      studyTips: Array.from({ length: 14 }, (_, i) => ({
        id: String(i),
        title: 'Tip',
        body: character.repeat(10000),
      })),
    });
  expect(parseParameter('data', payload('a')).studyTips).toHaveLength(14);
  expect(payload('é').length).toBeLessThan(262144);
  expect(Buffer.byteLength(payload('é'), 'utf8')).toBeGreaterThan(262144);
  expect(() => parseParameter('data', payload('é'))).toThrow(AppError);
});

test('required scalar fields reject unsupported values while additive fields are ignored', () => {
  expect(() =>
    parseParameter(
      'config',
      JSON.stringify({ ...defaults.config, reviewer: { shuffleQuestions: 'random' } }),
    ),
  ).toThrow(AppError);
  expect(() =>
    parseParameter(
      'app_info',
      JSON.stringify({
        ...defaults.app_info,
        minimumSupportedVersion: 'v1',
        supportEmail: 'invalid',
      }),
    ),
  ).toThrow(AppError);
  expect(
    parseParameter('config', JSON.stringify({ ...defaults.config, future: true })),
  ).not.toHaveProperty('future');
  expect(() =>
    parseParameter(
      'config',
      JSON.stringify({
        ...defaults.config,
        mockExam: {
          ...defaults.config.mockExam,
          distribution: { ...defaults.config.mockExam.distribution, unknown: 1 },
        },
      }),
    ),
  ).toThrow(AppError);
});
