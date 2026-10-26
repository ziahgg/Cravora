import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';

import { ToastProvider } from '@/components/toast';
import './globals.css';

const roboto = Roboto({ variable: '--font-roboto', subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: { default: 'Cravora', template: '%s · Cravora' },
  description: 'Order from local favorites, track every step, and reorder in one tap.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F6F6F6' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${roboto.variable} h-full`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
