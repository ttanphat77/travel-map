import { describe, expect, it } from 'vitest';
import { userReducer } from './store';
import { emptyUserData, NOTE_MAX_LENGTH, type PlaceCategory, type UserData } from './types';

const T1 = '2026-11-20T01:00:00.000Z';
const T2 = '2026-11-20T02:00:00.000Z';

function withJapanVisited(): UserData {
  return userReducer(emptyUserData(), { type: 'setStatus', kind: 'country', key: 'JPN', status: 'visited', now: T1 });
}

describe('userReducer', () => {
  it('đặt trạng thái cho một quốc gia', () => {
    expect(withJapanVisited().countries.JPN).toEqual({ status: 'visited', updatedAt: T1 });
  });

  it('đặt trạng thái cho một tỉnh', () => {
    const s = userReducer(emptyUserData(), { type: 'setStatus', kind: 'province', key: '79', status: 'wishlist', now: T1 });
    expect(s.provinces['79']).toEqual({ status: 'wishlist', updatedAt: T1 });
    expect(s.countries).toEqual({});
  });

  it('đổi trạng thái thì giữ nguyên ngày đến và ghi chú', () => {
    let s = withJapanVisited();
    s = userReducer(s, { type: 'updateDetails', kind: 'country', key: 'JPN', date: '2024-03', note: 'Tokyo', now: T1 });
    s = userReducer(s, { type: 'setStatus', kind: 'country', key: 'JPN', status: 'wishlist', now: T2 });
    expect(s.countries.JPN).toEqual({ status: 'wishlist', date: '2024-03', note: 'Tokyo', updatedAt: T2 });
  });

  it('bỏ đánh dấu thì xóa hẳn khóa', () => {
    const s = userReducer(withJapanVisited(), { type: 'clear', kind: 'country', key: 'JPN' });
    expect(s.countries).toEqual({});
  });

  it('không bao giờ lưu khóa VNM vào countries', () => {
    const s = userReducer(emptyUserData(), { type: 'setStatus', kind: 'country', key: 'VNM', status: 'visited', now: T1 });
    expect(s.countries).toEqual({});
    const r = userReducer(s, {
      type: 'restoreMark',
      kind: 'country',
      key: 'VNM',
      mark: { status: 'visited', updatedAt: T1 },
    });
    expect(r.countries).toEqual({});
  });

  it('không thêm ngày hay ghi chú cho vùng chưa đánh dấu', () => {
    const before = emptyUserData();
    const s = userReducer(before, { type: 'updateDetails', kind: 'country', key: 'JPN', note: 'x', now: T1 });
    expect(s).toBe(before);
  });

  it('chuỗi rỗng xóa ngày đến hoặc ghi chú', () => {
    let s = userReducer(withJapanVisited(), { type: 'updateDetails', kind: 'country', key: 'JPN', date: '2024-03', note: 'a', now: T1 });
    s = userReducer(s, { type: 'updateDetails', kind: 'country', key: 'JPN', date: '', note: '  ', now: T2 });
    expect(s.countries.JPN).toEqual({ status: 'visited', updatedAt: T2 });
  });

  it('cắt ghi chú dài hơn 1000 ký tự', () => {
    const s = userReducer(withJapanVisited(), {
      type: 'updateDetails',
      kind: 'country',
      key: 'JPN',
      note: 'a'.repeat(NOTE_MAX_LENGTH + 50),
      now: T1,
    });
    expect(s.countries.JPN?.note).toHaveLength(NOTE_MAX_LENGTH);
  });

  it('hoàn tác khôi phục đúng dấu cũ', () => {
    const before = withJapanVisited();
    const mark = before.countries.JPN;
    const cleared = userReducer(before, { type: 'clear', kind: 'country', key: 'JPN' });
    const restored = userReducer(cleared, { type: 'restoreMark', kind: 'country', key: 'JPN', mark });
    expect(restored.countries).toEqual(before.countries);
  });

  it('thêm ghim mới lên đầu danh sách, cắt khoảng trắng và bỏ trường rỗng', () => {
    let s = userReducer(emptyUserData(), {
      type: 'addPlace',
      id: 'a',
      fields: { name: 'Cũ', lat: 1, lng: 2, status: 'visited' },
      now: T1,
    });
    s = userReducer(s, {
      type: 'addPlace',
      id: 'b',
      fields: { name: '  Phố cổ Hội An  ', lat: 15.88, lng: 108.33, status: 'wishlist', date: '', note: ' ' },
      now: T2,
    });
    expect(s.places.map((p) => p.id)).toEqual(['b', 'a']);
    expect(s.places[0]).toEqual({
      id: 'b',
      name: 'Phố cổ Hội An',
      lat: 15.88,
      lng: 108.33,
      status: 'wishlist',
      createdAt: T2,
      updatedAt: T2,
    });
  });

  it('giữ loại ghim hợp lệ và bỏ loại không hợp lệ', () => {
    const s = userReducer(emptyUserData(), {
      type: 'addPlace',
      id: 'a',
      fields: { name: 'A', lat: 0, lng: 0, status: 'visited', category: 'cafe' },
      now: T1,
    });
    expect(s.places[0]?.category).toBe('cafe');
    const wrong = userReducer(s, {
      type: 'updatePlace',
      id: 'a',
      fields: { name: 'A', lat: 0, lng: 0, status: 'visited', category: 'karaoke' as PlaceCategory },
      now: T2,
    });
    expect(wrong.places[0]).not.toHaveProperty('category');
  });

  it('lưu vùng đã tra của ghim, giữ vùng khi sửa ghim tại chỗ và bỏ vùng khi ghim đổi tọa độ', () => {
    const fields = { name: 'A', lat: 20.9, lng: 107.07, status: 'visited' as const };
    let s = userReducer(emptyUserData(), { type: 'addPlace', id: 'a', fields, now: T1 });
    expect(s.places[0]).not.toHaveProperty('region');
    s = userReducer(s, { type: 'setPlaceRegion', id: 'a', lat: 20.9, lng: 107.07, region: { countryId: 'VNM', provinceCode: '22' } });
    expect(s.places[0]?.region).toEqual({ countryId: 'VNM', provinceCode: '22' });
    s = userReducer(s, { type: 'updatePlace', id: 'a', fields: { ...fields, name: 'B' }, now: T2 });
    expect(s.places[0]?.region).toEqual({ countryId: 'VNM', provinceCode: '22' });
    s = userReducer(s, { type: 'updatePlace', id: 'a', fields: { ...fields, lat: 10 }, now: T2 });
    expect(s.places[0]).not.toHaveProperty('region');
  });

  it('bỏ qua vùng tra được cho tọa độ cũ của ghim', () => {
    const s = userReducer(emptyUserData(), { type: 'addPlace', id: 'a', fields: { name: 'A', lat: 1, lng: 2, status: 'visited' }, now: T1 });
    expect(userReducer(s, { type: 'setPlaceRegion', id: 'a', lat: 5, lng: 2, region: { countryId: 'VNM' } })).toBe(s);
  });

  it('không thêm ghim có tên rỗng', () => {
    const before = emptyUserData();
    const s = userReducer(before, { type: 'addPlace', id: 'a', fields: { name: '   ', lat: 0, lng: 0, status: 'visited' }, now: T1 });
    expect(s).toBe(before);
  });

  it('cắt tên ghim dài hơn 120 ký tự', () => {
    const s = userReducer(emptyUserData(), {
      type: 'addPlace',
      id: 'a',
      fields: { name: 'x'.repeat(200), lat: 0, lng: 0, status: 'visited' },
      now: T1,
    });
    expect(s.places[0]?.name).toHaveLength(120);
  });

  it('sửa ghim giữ nguyên id và createdAt', () => {
    let s = userReducer(emptyUserData(), { type: 'addPlace', id: 'a', fields: { name: 'A', lat: 1, lng: 2, status: 'visited', note: 'n' }, now: T1 });
    s = userReducer(s, { type: 'updatePlace', id: 'a', fields: { name: 'B', lat: 1, lng: 2, status: 'wishlist' }, now: T2 });
    expect(s.places[0]).toEqual({ id: 'a', name: 'B', lat: 1, lng: 2, status: 'wishlist', createdAt: T1, updatedAt: T2 });
  });

  it('xóa ghim rồi hoàn tác thì ghim trở lại đúng vị trí', () => {
    let s = emptyUserData();
    for (const id of ['c', 'b', 'a']) {
      s = userReducer(s, { type: 'addPlace', id, fields: { name: id, lat: 0, lng: 0, status: 'visited' }, now: T1 });
    }
    const removed = s.places[1]!;
    const deleted = userReducer(s, { type: 'deletePlace', id: 'b' });
    expect(deleted.places.map((p) => p.id)).toEqual(['a', 'c']);
    const restored = userReducer(deleted, { type: 'restorePlace', place: removed, index: 1 });
    expect(restored.places.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('chỉ giữ một ghim quê nhà', () => {
    const add = (s: UserData, id: string, hometown?: boolean) =>
      userReducer(s, { type: 'addPlace', id, fields: { name: id, lat: 0, lng: 0, status: 'visited', hometown }, now: T1 });
    const hometowns = (s: UserData) => s.places.filter((p) => p.hometown).map((p) => p.id);
    let s = add(add(emptyUserData(), 'a', true), 'b');
    expect(hometowns(s)).toEqual(['a']);
    // Ghim không phải quê nhà thì không có trường hometown.
    expect(s.places.find((p) => p.id === 'b')).not.toHaveProperty('hometown');
    s = add(s, 'c', true);
    expect(hometowns(s)).toEqual(['c']);
    s = userReducer(s, { type: 'updatePlace', id: 'b', fields: { name: 'b', lat: 0, lng: 0, status: 'visited', hometown: true }, now: T2 });
    expect(hometowns(s)).toEqual(['b']);
    s = userReducer(s, { type: 'updatePlace', id: 'b', fields: { name: 'b', lat: 0, lng: 0, status: 'visited', hometown: false }, now: T2 });
    expect(hometowns(s)).toEqual([]);
  });

  it('hoàn tác xóa ghim quê nhà không làm mất quê nhà mới chọn', () => {
    let s = userReducer(emptyUserData(), { type: 'addPlace', id: 'a', fields: { name: 'a', lat: 0, lng: 0, status: 'visited', hometown: true }, now: T1 });
    const removed = s.places[0]!;
    s = userReducer(s, { type: 'deletePlace', id: 'a' });
    s = userReducer(s, { type: 'addPlace', id: 'b', fields: { name: 'b', lat: 0, lng: 0, status: 'visited', hometown: true }, now: T2 });
    s = userReducer(s, { type: 'restorePlace', place: removed, index: 1 });
    expect(s.places.filter((p) => p.hometown).map((p) => p.id)).toEqual(['b']);
  });

  it('không làm thay đổi state cũ', () => {
    const before = withJapanVisited();
    const snapshot = structuredClone(before);
    userReducer(before, { type: 'clear', kind: 'country', key: 'JPN' });
    expect(before).toEqual(snapshot);
  });
});
