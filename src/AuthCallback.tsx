import { useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    (async () => {
      try {
        // Exchange the code in the URL for a session
        await supabase.auth.exchangeCodeForSession(window.location.href);

        // Send user into the app (and removes the ?code= URL by switching pages)
        window.location.replace("/app");
      } catch (err) {
        console.error("Auth callback failed:", err);
        window.location.replace("/login?error=callback_failed");
      }
    })();
  }, []);

  return <div>Signing you in…</div>;
}