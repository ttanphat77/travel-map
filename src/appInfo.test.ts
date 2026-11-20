import { describe, expect, it } from 'vitest';
import { APP_ID, APP_TITLE } from './appInfo';

describe('appInfo', () => {
  it('có tên app tiếng Việt', () => {
    expect(APP_TITLE).toBe('Bản đồ hành trình');
  });

  it('có mã app dùng trong file xuất', () => {
    expect(APP_ID).toBe('travel-map');
  });
});
