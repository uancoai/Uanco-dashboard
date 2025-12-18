import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Loader2, Zap } from 'lucide-react';

const Auth = ({ onDemoLogin }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    alert('Link sent (check lib/supabase config)');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <span className="text-5xl font-serif font-bold italic text-uanco-900 mb-12 block">uanco.</span>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email Address" required className="w-full p-4 border rounded-xl" />
          <button type="submit" disabled={loading} className="w-full py-4 bg-uanco-900 text-white rounded-full font-medium">
            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Send Magic Link'}
          </button>
        </form>
        <button onClick={onDemoLogin} className="mt-8 text-xs font-bold uppercase tracking-widest text-uanco-400 flex items-center justify-center gap-2 mx-auto"><Zap size={14} /> Bypass for Demo</button>
      </div>
    </div>
  );
};
export default Auth;