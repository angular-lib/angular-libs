import { pad2 } from './date-time';

export interface DurationParts {
  h: number;
  m: number;
  s: number;
}

export function secondsToParts(seconds: number | null | undefined): DurationParts | null {
  if (seconds == null || !Number.isFinite(seconds)) {
    return null;
  }
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

export function partsToSeconds(h = 0, m = 0, s = 0): number {
  return Math.max(0, h) * 3600 + Math.max(0, m) * 60 + Math.max(0, s);
}

export function clampPart(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDurationPart(n: number): string {
  return pad2(n);
}

/** Parse `"1:30:00"`, `"01:30"`, `"90"` (seconds) into total seconds. */
export function parseDurationString(raw: string): number | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  const parts = text.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) {
    return null;
  }
  const nums = parts.map(Number);
  if (nums.length === 3) {
    return partsToSeconds(nums[0], nums[1], nums[2]);
  }
  if (nums.length === 2) {
    return partsToSeconds(0, nums[0], nums[1]);
  }
  return null;
}

export function clampSeconds(
  seconds: number,
  minSeconds?: number,
  maxSeconds?: number,
): number {
  let v = Math.max(0, seconds);
  if (minSeconds != null) {
    v = Math.max(minSeconds, v);
  }
  if (maxSeconds != null) {
    v = Math.min(maxSeconds, v);
  }
  return v;
}
