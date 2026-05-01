import { login, signup } from './actions'
import { AlertCircle, CheckCircle2, Trophy, Mail, Lock, Loader2 } from 'lucide-react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-8 animate-in fade-in duration-700">
      
      {/* Brand / Logo Section */}
      <div className="flex flex-col items-center gap-4 mb-12">
        <div className="w-20 h-20 bg-neon/10 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(74,222,128,0.15)] border border-neon/20">
          <Trophy size={40} className="text-neon" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black text-white tracking-tighter">BOTOLA FANTASY</h1>
          <p className="text-gray-500 text-sm font-medium uppercase tracking-widest mt-1">Draft. Compete. Win.</p>
        </div>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-[#0C1220] rounded-[32px] border border-white/[0.05] p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon/5 blur-[50px] rounded-full" />
        
        <form className="flex flex-col gap-5 relative z-10">
          <div className="flex flex-col gap-2">
             <label className="text-gray-500 text-[10px] font-black uppercase tracking-wider ml-1" htmlFor="email">Email Address</label>
             <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  placeholder="name@example.com"
                  className="w-full bg-[#1A2235] border border-white/[0.05] rounded-2xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-neon/30 transition-all"
                />
             </div>
          </div>

          <div className="flex flex-col gap-2">
             <label className="text-gray-500 text-[10px] font-black uppercase tracking-wider ml-1" htmlFor="password">Password</label>
             <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  className="w-full bg-[#1A2235] border border-white/[0.05] rounded-2xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-neon/30 transition-all"
                />
             </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button 
              formAction={login}
              className="bg-neon text-black font-black py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(74,222,128,0.2)]"
            >
              Sign In
            </button>
            <button 
              formAction={signup}
              className="bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all"
            >
              Create Account
            </button>
          </div>
        </form>
      </div>

      {/* Messaging / Errors */}
      <div className="mt-8 w-full max-w-sm">
        {searchParams.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-4">
             <AlertCircle className="text-red-500" size={20} />
             <span className="text-red-500 text-xs font-bold leading-tight">{searchParams.error}</span>
          </div>
        )}
        {searchParams.message && (
          <div className="bg-neon/10 border border-neon/20 rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-4">
             <CheckCircle2 className="text-neon" size={20} />
             <span className="text-neon text-xs font-bold leading-tight">{searchParams.message}</span>
          </div>
        )}
      </div>

      <p className="mt-12 text-gray-600 text-[10px] font-medium tracking-widest uppercase">
        Tournament Rules & Privacy Apply
      </p>

    </div>
  )
}
