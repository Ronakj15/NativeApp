import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn utility', () => {
  it('should merge tailwind classes', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('should conditionally merge classes', () => {
    expect(cn('p-2', true && 'text-red-500', false && 'bg-blue-500')).toBe('p-2 text-red-500');
  });

  it('should handle array inputs', () => {
    expect(cn(['p-2', 'text-center'])).toBe('p-2 text-center');
  });

  it('should handle object inputs', () => {
    expect(cn({ 'p-2': true, 'p-4': false })).toBe('p-2');
  });

  it('should handle a mix of inputs', () => {
    expect(cn('text-sm', ['font-bold', { 'text-red-500': true }])).toBe('text-sm font-bold text-red-500');
  });

  it('should merge complex tailwind classes properly', () => {
    expect(cn('px-2 py-1 bg-red hover:bg-dark-red', 'p-3 bg-[#B91C1C]')).toBe('hover:bg-dark-red p-3 bg-[#B91C1C]');
  });

  it('should handle undefined and null values gracefully', () => {
    expect(cn('text-sm', undefined, null, 'font-bold')).toBe('text-sm font-bold');
  });
});
