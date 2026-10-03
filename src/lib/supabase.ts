import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

// PKCE: the OAuth redirect carries a one-time code instead of tokens in the URL.
export const supabase = url && key ? createClient(url, key, { auth: { flowType: "pkce" } }) : null;
