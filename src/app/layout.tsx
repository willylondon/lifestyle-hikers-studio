import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lifestyle Hikers Studio',
  description:
    'AI content operating system for Lifestyle Hikers Jamaica — turn real hiking media into brand-aligned Instagram carousel campaigns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
