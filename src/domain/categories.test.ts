import { describe, expect, it } from 'vitest';
import { categoryForAttraction, categoryForPoi, countCategories } from './categories';
import type { Place } from './types';

const T = '2026-11-20T00:00:00.000Z';
const place = (id: string, category?: Place['category']): Place => ({
  id,
  name: id,
  lat: 0,
  lng: 0,
  status: 'visited',
  ...(category ? { category } : {}),
  createdAt: T,
  updatedAt: T,
});

describe('loại ghim', () => {
  it('chọn sẵn loại theo loại chi tiết, rồi theo nhóm loại của bản đồ nền', () => {
    expect(categoryForPoi('cafe', 'cafe')).toBe('cafe');
    expect(categoryForPoi('books', 'shop')).toBe('shopping');
    expect(categoryForPoi('hospital', 'hospital')).toBeUndefined();
    expect(categoryForPoi('constructor')).toBeUndefined();
  });

  it('chọn sẵn loại theo nhóm điểm đến của Wikidata', () => {
    expect(categoryForAttraction('religious')).toBe('religion');
    expect(categoryForAttraction('toString')).toBeUndefined();
  });

  it('đếm ghim theo loại, giữ thứ tự của form và bỏ ghim chưa có loại', () => {
    const counts = countCategories([place('a', 'cafe'), place('b', 'food'), place('c', 'cafe'), place('d')]);
    expect(counts).toEqual([
      { category: 'food', count: 1 },
      { category: 'cafe', count: 2 },
    ]);
  });
});
