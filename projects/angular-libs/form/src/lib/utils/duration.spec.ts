import { describe, expect, it } from 'vitest';
import {
  clampSeconds,
  parseDurationString,
  partsToSeconds,
  secondsToParts,
} from './duration';

describe('duration utils', () => {
  it('converts seconds ↔ parts', () => {
    expect(secondsToParts(5400)).toEqual({ h: 1, m: 30, s: 0 });
    expect(partsToSeconds(1, 30, 0)).toBe(5400);
    expect(secondsToParts(null)).toBeNull();
  });

  it('parses duration strings', () => {
    expect(parseDurationString('1:30:00')).toBe(5400);
    expect(parseDurationString('01:30')).toBe(90);
    expect(parseDurationString('90')).toBe(90);
    expect(parseDurationString('')).toBeNull();
  });

  it('clamps seconds', () => {
    expect(clampSeconds(10, 60, 120)).toBe(60);
    expect(clampSeconds(200, 60, 120)).toBe(120);
  });
});
