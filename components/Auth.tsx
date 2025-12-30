import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Zap } from "lucide-react";

const Auth = ({ onDemoLogin }: { onDemoLogin?: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLinkSent(false);
    setSentEmail(null);
    setErrorMsg(null);
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("[signInWithOtp] error:", error);
        setErrorMsg(error.message);
        setLinkSent(false);
        setSentEmail(null);
      } else {
        setLinkSent(true);
        setSentEmail(email);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <span className="text-5xl font-serif font-bold italic text-uanco-900 mb-12 block">
          uanco.
        </span>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email Address"
            required
            className="w-full p-4 border rounded-xl"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-uanco-900 text-white rounded-full font-medium"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : "Send Magic Link"}
          </button>
        </form>

        {linkSent && sentEmail && (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800">
              Magic link sent
            </p>
            <p className="mt-1 text-[12px] text-emerald-800">
              Check <span className="font-semibold">{sentEmail}</span> to continue.
            </p>
            <p className="mt-1 text-[11px] text-emerald-700">
              Didn’t receive it? Check spam or try again.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left">
            <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
              Couldn’t send link
            </p>
            <p className="mt-1 text-[12px] text-rose-700">{errorMsg}</p>
          </div>
        )}

        {onDemoLogin && (
          <button
            onClick={onDemoLogin}
            className="mt-8 text-xs font-bold uppercase tracking-widest text-uanco-400 flex items-center justify-center gap-2 mx-auto"
          >
            <Zap size={14} /> Bypass for Demo
          </button>
        )}
      </div>
    </div>
  );
};

export default Auth;