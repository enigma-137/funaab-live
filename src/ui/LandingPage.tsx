import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import worldData from '../worlds/funaab/world.json';
import { Users, ArrowRight, ShieldCheck, MapPin, Play } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { guestLogin, login, signup, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [college, setCollege] = useState('COLENG');
  const isGuestModeEnabled = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
  const [isAuthMode, setIsAuthMode] = useState(!isGuestModeEnabled);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleQuickEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGuestModeEnabled) return;
    const finalName = username.trim() || `Aluta_${Math.floor(Math.random() * 900 + 100)}`;
    guestLogin(finalName, college);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      await signup(username, college, email, password);
    } else {
      await login(email, password);
    }
  };

  const selectedCollegeObj = worldData.colleges.find((c) => c.code === college);

  return (
    <div className="relative w-screen h-screen overflow-y-auto bg-[#070d08] text-slate-100 flex flex-col justify-between font-['Plus_Jakarta_Sans'] select-none">
      {/* Background Gradients & Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-green-500/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-600/30 border border-emerald-400/40">
            🎓
          </div>
          <div>
            <span className="font-['Outfit'] font-black text-xl tracking-tight text-white flex items-center gap-2">
              FUNAAB <span className="text-emerald-400">Life</span>
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                V0 PLAYABLE
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Campus is Online</span>
          </div>
        </div>
      </header>

      {/* Main Hero & Login Box */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-12 gap-12 items-center my-auto">
        {/* Left Side: Product Intro */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">

            The Virtual Nigerian Campus Experience
          </div>

          <h1 className="font-['Outfit'] font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-none">
            Step onto campus. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-green-300 to-teal-200">
              Meet real students.
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-xl leading-relaxed">
            Walk past the Ceremonial Main Gate, catch a yellow Keke Napep to COLFHEC, grab hot Jollof at Mama Buka, or challenge your peers in the PlayStation Room.
          </p>

          {/* Campus Live Status Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-['Outfit'] font-extrabold text-sm text-white">FUNAAB LIFE • Campus is online</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                Active Session
              </span>
            </div>
            <div className="text-xs text-slate-300 mb-2">
              Popular right now on campus:
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Car Park</span>
                <strong className="text-emerald-400 font-mono">· 8</strong>
              </div>
              <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Sports Centre</span>
                <strong className="text-indigo-300 font-mono">· 6</strong>
              </div>
              <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>COLBIOS</span>
                <strong className="text-amber-300 font-mono">· 4</strong>
              </div>
              <div className="px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-700 text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                <span>Senate Plaza</span>
                <strong className="text-teal-300 font-mono">· 3</strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl mb-1">🛺</div>
              <div className="font-bold text-white text-xs">Live Keke Rides</div>
              <div className="text-[11px] text-slate-400">Hop in & travel (₦50–₦150)</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl mb-1">💼</div>
              <div className="font-bold text-white text-xs">Campus Jobs</div>
              <div className="text-[11px] text-slate-400">Deliver food & earn ₦300</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-2xl mb-1">💸</div>
              <div className="font-bold text-white text-xs">Send Money</div>
              <div className="text-[11px] text-slate-400">P2P student transfers</div>
            </div>
          </div>
        </div>

        {/* Right Side: Instant Spawn Card */}
        <div className="lg:col-span-5">
          <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-emerald-500/30 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-['Outfit'] font-bold text-xl text-white">
                {isAuthMode ? (isSignUp ? 'Create Account' : 'Sign In') : 'Instant Campus Entry'}
              </h2>
              {isGuestModeEnabled && (
                <button
                  type="button"
                  onClick={() => setIsAuthMode(!isAuthMode)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
                >
                  {isAuthMode ? 'Guest Mode' : 'Account Login'}
                </button>
              )}
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs">
                {error}
              </div>
            )}

            {!isAuthMode ? (
              /* Instant Quick Enter Form */
              <form onSubmit={handleQuickEnter} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Your Username / Nickname
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Emmanuel, Tobi, Blessing..."
                    maxLength={20}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm font-medium transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Your College
                  </label>
                  <select
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 text-sm font-medium transition"
                  >
                    {worldData.colleges.map((col) => (
                      <option key={col.code} value={col.code}>
                        {col.code} - {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Starting Balance:</span>
                  <span className="font-extrabold text-emerald-400 font-['Outfit'] text-sm">
                    ₦5,000.00
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-['Outfit'] font-black text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Enter FUNAAB Campus</span>
                </button>
              </form>
            ) : (
              /* Persistent Account Form (Supabase Auth) */
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. Emmanuel"
                        required
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">College</label>
                      <select
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                      >
                        {worldData.colleges.map((col) => (
                          <option key={col.code} value={col.code}>
                            {col.code} - {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@funaab.edu.ng"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg transition"
                >
                  {isLoading ? 'Processing...' : isSignUp ? 'Create & Enter' : 'Sign In & Enter'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
        <div>FUNAAB Life MVP • Built for Abeokuta Students</div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <span>WASD to Walk</span>
          <span>•</span>
          <span>Shift to Run</span>
          <span>•</span>
          <span>E to Interact</span>
        </div>
      </footer>
    </div>
  );
};
