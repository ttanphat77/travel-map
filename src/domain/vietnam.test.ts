import { describe, expect, it } from 'vitest';
import { PROVINCES } from '../data/provinces';
import type { Mark, MarkStatus } from './types';
import { summarizeVietnam } from './vietnam';

const mark = (status: MarkStatus): Mark => ({ status, updatedAt: '2026-11-20T00:00:00.000Z' });

describe('summarizeVietnam', () => {
  it('chưa có tỉnh nào thì Việt Nam chưa đánh dấu', () => {
    expect(summarizeVietnam({})).toEqual({ status: undefined, visited: 0, wishlist: 0, total: 34 });
  });

  it('chỉ có tỉnh "Muốn đến" thì Việt Nam là "Muốn đến"', () => {
    expect(summarizeVietnam({ '79': mark('wishlist') }).status).toBe('wishlist');
  });

  it('có cả hai loại thì Việt Nam là "Đã đến"', () => {
    const s = summarizeVietnam({ '79': mark('visited'), '01': mark('wishlist') });
    expect(s).toEqual({ status: 'visited', visited: 1, wishlist: 1, total: 34 });
  });

  it('đủ 34 tỉnh "Đã đến"', () => {
    const all = Object.fromEntries(PROVINCES.map((p) => [p.code, mark('visited')]));
    expect(summarizeVietnam(all)).toEqual({ status: 'visited', visited: 34, wishlist: 0, total: 34 });
  });

  it('bỏ qua mã không thuộc 34 tỉnh', () => {
    expect(summarizeVietnam({ '99': mark('visited') }).status).toBeUndefined();
  });
});
