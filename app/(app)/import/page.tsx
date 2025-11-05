import { getAuthenticatedUser } from '@/lib/auth';
import { ImportPageClient } from './import-client';

export default async function ImportPage() {
  // SECURITY: Require authentication
  await getAuthenticatedUser();

  return <ImportPageClient />;
}
