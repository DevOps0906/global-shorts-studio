import { createBrowserClient } from "@supabase/ssr";

// 브라우저용. publishable(anon) 키만 쓴다. service_role은 워커에서만.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
