/* GET /api/studio-config → what the /studio page needs to start: the Clerk publishable key (public by design) and which
   services are configured (names and booleans only, never a secret value). */
import { json, STORE_KIND } from './_studio.mjs';
import { storeConfigured } from './_store.mjs';

export async function GET() {
  return json(200, {
    clerkPublishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || null,
    configured: {
      login: Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      storage: storeConfigured(),
      store: STORE_KIND,
      agent: Boolean(process.env.FAL_KEY),
    },
  });
}
