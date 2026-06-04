import type { TimeMode, TimePolicy } from '../payload/payloadTypes';
import { DEFAULT_ALLOWED_DRIFT_SECONDS } from '../payload/payloadTypes';

export function normalizeTimePolicy(policy?: TimePolicy): Required<TimePolicy> {
  const notBefore = policy?.notBefore ?? 0;
  const expiresAt = policy?.expiresAt ?? 0;
  const mode: TimeMode = notBefore === 0 && expiresAt === 0 ? 'none' : 'local_soft';
  return {
    mode,
    notBefore,
    expiresAt,
    allowedDriftSeconds: policy?.allowedDriftSeconds ?? DEFAULT_ALLOWED_DRIFT_SECONDS
  };
}

export function datetimeLocalToUnixSeconds(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? Math.floor(milliseconds / 1000) : undefined;
}

export function unixSecondsToDatetimeLocal(value: number | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value * 1000);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
