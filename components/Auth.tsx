import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Zap } from "lucide-react";

const Auth = ({ onDemoLogin }: { onDemoLogin?: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error("[signInWithOtp] error:", error);
        alert(error.message);
      } else {
        // Optional UX: tell user to check email
        // alert("Check your email for the magic link.");
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