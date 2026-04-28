import { describe, it, expect } from 'vitest';
import { descriptorDistance } from './face-api';

describe('descriptorDistance', () => {
  it('should return 0 for identical descriptors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(descriptorDistance(a, b)).toBe(0);
  });

  it('should calculate Euclidean distance correctly', () => {
    const a = [0, 0];
    const b = [3, 4];
    expect(descriptorDistance(a, b)).toBe(5);
  });

  it('should calculate Euclidean distance correctly for 3D arrays', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // sqrt((1-4)^2 + (2-5)^2 + (3-6)^2) = sqrt(9 + 9 + 9) = sqrt(27) = 5.196...
    expect(descriptorDistance(a, b)).toBeCloseTo(5.1961524227);
  });

  it('should return Number.POSITIVE_INFINITY when arrays have different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(descriptorDistance(a, b)).toBe(Number.POSITIVE_INFINITY);
  });

  it('should return 0 for empty arrays', () => {
    expect(descriptorDistance([], [])).toBe(0);
  });

  it('should handle negative numbers', () => {
    const a = [-1, -2, -3];
    const b = [1, 2, 3];
    // sqrt((-1-1)^2 + (-2-2)^2 + (-3-3)^2) = sqrt(4 + 16 + 36) = sqrt(56) = 7.483...
    expect(descriptorDistance(a, b)).toBeCloseTo(7.4833147735);
  });
});
