import { CLIENT_VERSION } from './version.g';

const CLIENT_NAME = 'max-bot-api-client-ts';

export function getTelemetryHeaders(): Record<string, string> {
  const runtime = typeof process !== 'undefined' && process.versions?.node
    ? `node${process.versions.node}`
    : 'unknown';

  return {
    'X-Max-Client-Name': CLIENT_NAME,
    'X-Max-Client-Version': CLIENT_VERSION,
    'X-Max-Client-Runtime': runtime,
  };
}
