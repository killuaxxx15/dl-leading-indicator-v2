import { AppShell } from '@/components/AppShell';
import { fetchAll } from '@/lib/fetchIndicators';
import type { ApiResponse } from '@/lib/types';

// ISR: Vercel re-generates this page at most once per hour.
// Every visitor within that window gets pre-built HTML with live data — no client-side flash.
export const revalidate = 3600;

export default async function Home() {
  const FRED_KEY = process.env.FRED_API_KEY || '';
  let initialData: ApiResponse | null = null;

  if (FRED_KEY && FRED_KEY !== 'your_fred_api_key_here') {
    try {
      initialData = await fetchAll(FRED_KEY);
    } catch {
      // initialData stays null; AppShell handles the empty state gracefully
    }
  }

  return <AppShell initialData={initialData} />;
}
