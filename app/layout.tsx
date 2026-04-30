import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CIO Growth & Inflation Leading Indicator · DeLorean Partners',
  description:
    'Mechanical weighted z-score composite across leading economic indicators. Live data from FRED, Yahoo Finance, Zillow, and Atlanta Fed.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
