import { expect, test } from 'vitest';
import { uuid } from './crypto';
import { getSessionId } from './session';

const sourceId = '2e2fc91f-77a7-4e5d-a7b1-18a74c67b4e0';
const sessionSalt = 'monthly-session-salt';

test('keeps identified sessions stable on the same device', () => {
  const args = [sourceId, '192.0.2.1', 'Desktop Browser', sessionSalt, 'user-123'] as const;

  expect(getSessionId(...args)).toBe(getSessionId(...args));
});

test('creates separate sessions for the same distinct ID on different devices', () => {
  const desktopSessionId = getSessionId(
    sourceId,
    '192.0.2.1',
    'Desktop Browser',
    sessionSalt,
    'user-123',
  );
  const mobileSessionId = getSessionId(
    sourceId,
    '198.51.100.2',
    'Mobile Browser',
    sessionSalt,
    'user-123',
  );

  expect(desktopSessionId).not.toBe(mobileSessionId);
});

test('does not merge different identified users on the same device', () => {
  const firstUserSessionId = getSessionId(
    sourceId,
    '192.0.2.1',
    'Desktop Browser',
    sessionSalt,
    'user-123',
  );
  const secondUserSessionId = getSessionId(
    sourceId,
    '192.0.2.1',
    'Desktop Browser',
    sessionSalt,
    'user-456',
  );

  expect(firstUserSessionId).not.toBe(secondUserSessionId);
});

test('preserves anonymous session IDs', () => {
  expect(getSessionId(sourceId, '192.0.2.1', 'Desktop Browser', sessionSalt)).toBe(
    uuid(sourceId, '192.0.2.1', 'Desktop Browser', sessionSalt),
  );
});
