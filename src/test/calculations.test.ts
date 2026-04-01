import { describe, expect, it } from 'vitest';

import { lookupFoundation } from '@/lib/calculations';

describe('foundation lookup', () => {
  it('returns zero when foundation drawings are not required', () => {
    expect(lookupFoundation(4000, 'none')).toBe(0);
  });
});
