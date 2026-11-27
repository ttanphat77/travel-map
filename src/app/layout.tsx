import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { APP_TITLE } from '../appInfo';
import '../styles/tokens.css';

/**
 * Phông chữ hiển thị tiếng Việt tốt. Next.js tải phông lúc build rồi tự phục vụ,
 * nên trình duyệt của người dùng không gửi yêu cầu nào tới Google.
 */
const appFont = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-app',
});

export const metadata: Metadata = {
  title: APP_TITLE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={appFont.variable}>
      <body>{children}</body>
    </html>
  );
}
