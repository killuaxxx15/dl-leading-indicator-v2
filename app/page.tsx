import fs from 'fs';
import path from 'path';
import { AppShell } from '@/components/AppShell';
import type { ApiResponse } from '@/lib/types';

export default function Home() {
  let initialData: ApiResponse | null = null;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public', 'indicators.json'), 'utf8');
    initialData = JSON.parse(raw) as ApiResponse;
  } catch {
    // File missing or malformed — AppShell handles null gracefully
  }
  return <AppShell initialData={initialData} />;
}
