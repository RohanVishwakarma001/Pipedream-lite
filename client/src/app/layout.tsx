import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pipedream-lite — Visual Webhook Pipeline Builder',
  description:
    'Wire APIs together visually. No Zapier subscription. No self-hosted VM. Just draw the flow and ship it.',
  icons: { icon: '⚡' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
