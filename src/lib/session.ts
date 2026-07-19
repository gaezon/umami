import { uuid } from './crypto';

export function getSessionId(
  sourceId: string,
  ip: string,
  userAgent: string,
  sessionSalt: string,
  distinctId?: string,
) {
  return distinctId
    ? uuid(sourceId, ip, userAgent, sessionSalt, distinctId)
    : uuid(sourceId, ip, userAgent, sessionSalt);
}
