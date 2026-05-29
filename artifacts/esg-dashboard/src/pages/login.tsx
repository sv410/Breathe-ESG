import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Leaf, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Breathe ESG</h1>
          <p className="text-sm text-slate-400 mt-1">Carbon data platform</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-7 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Sign in to your account</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your analyst credentials to continue</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mb-5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="analyst"
                required
                autoFocus
                className="w-full h-11 bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 bg-slate-900/60 border border-slate-600/50 rounded-xl px-4 pr-11 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : "Sign in"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 text-center">Demo credentials</p>
            <div className="mt-2 bg-slate-900/60 rounded-lg p-3 font-mono text-xs text-slate-400 space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">username</span><span className="text-emerald-400">analyst</span></div>
              <div className="flex justify-between"><span className="text-slate-500">password</span><span className="text-emerald-400">breathe2024</span></div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Breathe ESG · Carbon Accounting Platform
        </p>
      </div>
    </div>
  );
}
