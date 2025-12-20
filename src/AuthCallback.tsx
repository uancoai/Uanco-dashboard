import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    (async () => {
      try {
        // 1) Exchange the ?code=... for a session (PKCE)
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        // 2) Clean the URL so refresh doesn't keep re-processing the callback
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState({}, document.title, url.pathname + url.hash);

        // 3) Send user to the app root (SPA-safe)
        window.location.replace("/");
      } catch (err) {
        console.error("Auth callback failed:", err);
        window.location.replace("/?auth=callback_failed");
      }
    })();
  }, []);

  return <div>Signing you in…</div>;
}