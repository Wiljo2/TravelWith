export interface EntryEnv {
  search: string;
  storageKeys: string[];
  offline: boolean;
  hasSnapshot: boolean;
  standalone: boolean;
  localModeEnabled: boolean;
}

const SUPABASE_SESSION_KEY = /^sb-.+-auth-token$/;

export function shouldEnterApp(env: EntryEnv): boolean {
  const params = new URLSearchParams(env.search);
  if (params.has("app") || params.has("code") || params.has("join")) return true;
  if (params.has("error") || params.has("error_description")) return true;
  // `?local=new` starts the first-run sandbox, which begins on the landing like a new visitor.
  if (params.get("local") === "new" && env.localModeEnabled) return false;
  if (params.has("local") && env.localModeEnabled) return true;
  if (env.storageKeys.some((key) => SUPABASE_SESSION_KEY.test(key))) return true;
  if (env.offline && env.hasSnapshot) return true;
  return env.standalone;
}
