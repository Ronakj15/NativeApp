import { describe, it, expect } from 'vitest';
import { eyeAspectRatio, descriptorDistance } from './face-api';

describe('face-api mathematical helpers', () => {
  describe('eyeAspectRatio', () => {
    it('calculates the aspect ratio of a wide open eye correctly', () => {
      // Mock coordinates for an open eye (approximate squareish)
      const eye = [
        { x: 0, y: 5 },   // p1 (left corner)
        { x: 3, y: 1 },   // p2 (top left)
        { x: 7, y: 1 },   // p3 (top right)
        { x: 10, y: 5 },  // p4 (right corner)
        { x: 7, y: 9 },   // p5 (bottom right)
        { x: 3, y: 9 },   // p6 (bottom left)
      ];

      // v1: p2-p6 = dist({3,1}, {3,9}) = 8
      // v2: p3-p5 = dist({7,1}, {7,9}) = 8
      // h: p1-p4 = dist({0,5}, {10,5}) = 10
      // EAR = (8 + 8) / (2 * 10) = 16 / 20 = 0.8

      expect(eyeAspectRatio(eye)).toBeCloseTo(0.8);
    });

    it('calculates the aspect ratio of a closed eye correctly', () => {
      // Mock coordinates for a closed eye (very flat)
      const eye = [
        { x: 0, y: 5 },   // p1
        { x: 3, y: 4.8 }, // p2
        { x: 7, y: 4.8 }, // p3
        { x: 10, y: 5 },  // p4
        { x: 7, y: 5.2 }, // p5
        { x: 3, y: 5.2 }, // p6
      ];

      // v1: p2-p6 = dist({3,4.8}, {3,5.2}) = 0.4
      // v2: p3-p5 = dist({7,4.8}, {7,5.2}) = 0.4
      // h: p1-p4 = dist({0,5}, {10,5}) = 10
      // EAR = (0.4 + 0.4) / (2 * 10) = 0.8 / 20 = 0.04

      expect(eyeAspectRatio(eye)).toBeCloseTo(0.04);
    });

    it('handles zero width eyes gracefully by returning Infinity', () => {
      const eye = [
        { x: 5, y: 5 },  // p1
        { x: 5, y: 2 },  // p2
        { x: 5, y: 2 },  // p3
        { x: 5, y: 5 },  // p4 (same as p1)
        { x: 5, y: 8 },  // p5
        { x: 5, y: 8 },  // p6
      ];

      expect(eyeAspectRatio(eye)).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe('descriptorDistance', () => {
    it('returns positive infinity for mismatched descriptor lengths', () => {
      expect(descriptorDistance([1, 2], [1, 2, 3])).toBe(Number.POSITIVE_INFINITY);
    });

    it('calculates euclidean distance correctly', () => {
      expect(descriptorDistance([0, 0], [3, 4])).toBe(5);
      expect(descriptorDistance([1, 1, 1], [2, 2, 2])).toBeCloseTo(Math.sqrt(3));
    });

    it('calculates Euclidean distance correctly for 3D arrays', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      // sqrt((1-4)^2 + (2-5)^2 + (3-6)^2) = sqrt(9 + 9 + 9) = sqrt(27) = 5.196...
      expect(descriptorDistance(a, b)).toBeCloseTo(5.1961524227);
    });

    it('returns 0 for identical descriptors', () => {
      expect(descriptorDistance([1.5, -2.5, 3], [1.5, -2.5, 3])).toBe(0);
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
});
