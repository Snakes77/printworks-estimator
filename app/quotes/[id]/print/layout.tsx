import { ReactNode } from 'react';

export default function PrintLayout({ children }: { children: ReactNode }) {
  // This layout bypasses the root layout for clean PDF generation
  return children;
}
