import type { UserData } from '../domain/types';

const API_URL = '/api/data';

/** Tải dữ liệu người dùng đã lưu trên server. */
export async function loadUserData(): Promise<UserData> {
  const response = await fetch(API_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Không tải được dữ liệu người dùng (mã lỗi ${response.status})`);
  return (await response.json()) as UserData;
}

/** Gửi toàn bộ dữ liệu người dùng lên server. Server ghi đè file đang có. */
export async function saveUserData(data: UserData): Promise<void> {
  const response = await fetch(API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`Không lưu được dữ liệu người dùng (mã lỗi ${response.status})`);
}
