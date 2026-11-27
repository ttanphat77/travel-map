'use client';

import dynamic from 'next/dynamic';

/**
 * Thư viện bản đồ MapLibre cần `window` và WebGL, nên không chạy được trên server.
 * Vì vậy toàn bộ app chỉ được nạp và vẽ trên trình duyệt.
 */
const App = dynamic(() => import('../App'), { ssr: false });

export default function ClientApp() {
  return <App />;
}
