import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowRight, Mail, Loader2, Zap } from 'lucide-react';

interface AuthProps {
  onDemoLogin?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onDemoLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-12">
          <span className="text-5xl font-serif font-bold italic tracking-tight text-uanco-900 block mb-2">uanco.</span>
          <p className="text-uanco-400 text-xs font-bold uppercase tracking-widest">Partner Portal</p>
        </div>

        <div className="text-left space-y-4 mb-8">
          <h2 className="text-2xl font-medium text-uanco-900">Sign In</h2>
          <p className="text-sm text-uanco-500 leading-relaxed">
            Enter your email address to receive a secure magic link for instant access to your dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-uanco-400" size={18} />
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address" 
              required
              className="w-full p-4 pl-12 bg-white border border-uanco-200 focus:border-uanco-900 focus:ring-0 rounded-xl text-uanco-900 placeholder:text-uanco-400 transition-all"
            />
          </div>

          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
              {message.text}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-uanco-900 text-white rounded-full font-medium text-sm hover:bg-black transition-colors shadow-soft flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <>Send Magic Link <ArrowRight size={16} /></>}
          </button>
        </form>

        <div className="mt-6">
            <button 
                type="button"
                onClick={onDemoLogin}
                className="text-xs text-uanco-400 hover:text-uanco-900 font-bold uppercase tracking-widest flex items-center justify-center gap-2 mx-auto transition-colors"
            >
                <Zap size={14} /> Bypass for Demo
            </button>
        </div>

        <div className="mt-8 pt-6 border-t border-uanco-100">
          <p className="text-[10px] text-uanco-400 uppercase font-bold">Secure Clinic Access Provided by UANCO AI</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;