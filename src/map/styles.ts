import type { PlaceCategory } from '../domain/types';

/** Màu dùng trên bản đồ. Phải khớp với các biến màu trong src/styles/tokens.css. */
export const COLORS = {
  accent: '#2563eb',
  unmarkedStroke: '#8a8f98',
  visited: '#3fa36b',
  visitedStroke: '#2f7d52',
  wishlist: '#f0a33a',
  wishlistStroke: '#b87717',
  oldBorder: '#6b7280',
  islandLabel: '#1e3a5f',
  /** Ghim chưa có loại. */
  uncategorized: '#495057',
  /** Nền tròn của ghim quê nhà. */
  hometown: '#e03131',
} as const;

/**
 * Màu của ghim trên bản đồ theo loại ghim. Mỗi loại có một sắc màu riêng để nhìn là phân biệt được.
 * Các màu đủ đậm để đọc được trên nền bản đồ sáng.
 */
export const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  heritage: '#c92a2a',
  food: '#f76707',
  cafe: '#8b5a2b',
  fun: '#e0a100',
  park: '#74b816',
  nature: '#2f9e44',
  sightseeing: '#0c8599',
  beach: '#1c7ed6',
  museum: '#4c6ef5',
  shopping: '#7048e8',
  religion: '#ae3ec9',
  stay: '#d6336c',
};
