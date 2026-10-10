import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import worldData from '../worlds/funaab/world.json';
import { Users, ChevronDown, Check, Search, MapPin, Compass, MessageCircle, Building2, Play } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { guestLogin, login, signup, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [college, setCollege] = useState('COLENG');
  const isGuestModeEnabled = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
  const [isAuthMode, setIsAuthMode] = useState(!isGuestModeEnabled);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Custom College Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const selectedCollegeObj = worldData.colleges.find((c) => c.code === college) || worldData.colleges[0];
  const filteredColleges = worldData.colleges.filter(
    (c) =>
      c.code.toLowerCase().includes(collegeSearch.toLowerCase()) ||
      c.name.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 overflow-y-auto w-full bg-[#F7F9F5] text-[#17211B] flex flex-col justify-between font-['Plus_Jakarta_Sans'] select-none">
      {/* Subtle Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#15B86A]/5 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-[#008751]/4 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 w-[500px] h-[500px] rounded-full bg-[#15B86A]/4 blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#008751] flex items-center justify-center text-white text-xl shadow-sm">
            🎓
          </div>
          <div className="flex items-center gap-2">
            <span className="font-['Outfit'] font-black text-xl sm:text-2xl tracking-tight text-[#17211B]">
              FUNAAB <span className="text-[#008751]">Life</span>
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#008751] border border-[#C8E6C9] uppercase tracking-wider">
              Public Beta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGuestModeEnabled && (
            <button
              type="button"
              onClick={() => setIsAuthMode(!isAuthMode)}
              className="px-3.5 py-1.5 rounded-xl border border-[#E5EAE6] bg-white text-xs font-semibold text-[#17211B] hover:bg-[#F0F4F1] transition shadow-sm"
            >
              {isAuthMode ? 'Guest Mode' : 'Account Mode'}
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E5EAE6] text-xs font-medium text-[#17211B] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#15B86A] animate-pulse" />
            <Users className="w-3.5 h-3.5 text-[#008751]" />
            <span className="hidden xs:inline">Campus Live</span>
          </div>
        </div>
      </header>

      {/* Main Content: Hero & Auth Card */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">
        {/* Left Column: Platform Intro & Features */}
        <div className="lg:col-span-7 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#008751] text-xs font-bold tracking-wide">
            <span>Built for FUNAAB students</span>
          </div>

          {/* Hero Headline */}
          <h1 className="font-['Outfit'] font-black text-3xl sm:text-5xl lg:text-6xl text-[#17211B] tracking-tight leading-[1.12]">
            Step onto campus. <br />
            <span className="text-[#008751]">Meet real students.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-[#66736B] text-sm sm:text-base lg:text-lg max-w-xl leading-relaxed">
            Explore FUNAAB, meet students, take keke, attend lectures, hang out and discover the campus together.
          </p>

          {/* Live Campus Status Card */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5EAE6] shadow-sm space-y-2.5 max-w-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15B86A] animate-pulse" />
                <span className="font-['Outfit'] font-extrabold text-sm text-[#17211B]">
                  Campus is live
                </span>
              </div>
              <span className="text-xs font-semibold text-[#008751] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full">
                ● 24 students online
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#66736B]">
              <span className="font-semibold text-[#17211B]">Popular:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F9F5] border border-[#E5EAE6] text-[#17211B]">
                  Car Park <strong className="text-[#008751]">· 8</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F9F5] border border-[#E5EAE6] text-[#17211B]">
                  COLFHEC <strong className="text-[#008751]">· 6</strong>
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#F7F9F5] border border-[#E5EAE6] text-[#17211B]">
                  Sports Centre <strong className="text-[#008751]">· 5</strong>
                </span>
              </div>
            </div>
          </div>

          {/* 3 Simple Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 max-w-lg lg:max-w-none">
            <div className="p-4 rounded-2xl bg-white border border-[#E5EAE6] shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-lg mb-2">
                🛺
              </div>
              <div className="font-['Outfit'] font-bold text-sm text-[#17211B]">Explore FUNAAB</div>
              <div className="text-xs text-[#66736B] mt-0.5">Walk, ride and discover campus.</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5EAE6] shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-lg mb-2">
                💬
              </div>
              <div className="font-['Outfit'] font-bold text-sm text-[#17211B]">Meet students</div>
              <div className="text-xs text-[#66736B] mt-0.5">Chat and interact with real students.</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E5EAE6] shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-[#E8F5E9] flex items-center justify-center text-lg mb-2">
                🏛️
              </div>
              <div className="font-['Outfit'] font-bold text-sm text-[#17211B]">Live campus</div>
              <div className="text-xs text-[#66736B] mt-0.5">Lectures, food spots, jobs & activities.</div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean White Auth Card */}
        <div className="lg:col-span-5">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E5EAE6] shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <div className="mb-6">
              <h2 className="font-['Outfit'] font-black text-2xl text-[#17211B] tracking-tight">
                {isAuthMode
                  ? isSignUp
                    ? 'Create your student profile'
                    : 'Welcome back'
                  : 'Instant Campus Entry'}
              </h2>
              <p className="text-xs sm:text-sm text-[#66736B] mt-1">
                {isAuthMode
                  ? isSignUp
                    ? 'Join FUNAAB Life in a few seconds.'
                    : 'Enter your credentials to step back onto campus.'
                  : 'Hop directly into the campus as a guest.'}
              </p>
            </div>

            {error && (
              <div className="p-3 mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {error}
              </div>
            )}

            {!isAuthMode ? (
              /* Instant Quick Enter Form (Guest Dev Mode) */
              <form onSubmit={handleQuickEnter} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                    Username / Nickname
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Emmanuel"
                    maxLength={20}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] placeholder-[#9EA8A1] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition"
                  />
                </div>

                {/* College Selection */}
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                    College
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition flex items-center justify-between"
                  >
                    <span className="truncate">
                      <strong>{selectedCollegeObj.code}</strong> — {selectedCollegeObj.name}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#66736B] shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E5EAE6] rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 border-b border-[#E5EAE6]">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F9F5] text-xs text-[#17211B]">
                          <Search className="w-3.5 h-3.5 text-[#66736B] shrink-0" />
                          <input
                            type="text"
                            value={collegeSearch}
                            onChange={(e) => setCollegeSearch(e.target.value)}
                            placeholder="Search colleges..."
                            className="bg-transparent border-none outline-none w-full text-xs placeholder-[#9EA8A1]"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto p-1.5 space-y-1">
                        {filteredColleges.map((col) => {
                          const isSelected = col.code === college;
                          return (
                            <button
                              key={col.code}
                              type="button"
                              onClick={() => {
                                setCollege(col.code);
                                setIsDropdownOpen(false);
                                setCollegeSearch('');
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs transition flex items-center justify-between ${isSelected ? 'bg-[#E8F5E9] text-[#008751] font-bold' : 'hover:bg-[#F0F4F1] text-[#17211B]'
                                }`}
                            >
                              <div>
                                <span className="font-extrabold">{col.code}</span>
                                <span className="text-[#66736B] block text-[11px]">{col.name}</span>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#008751] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#F7F9F5] border border-[#E5EAE6] flex items-center justify-between text-xs">
                  <span className="text-[#66736B]">Starting Balance:</span>
                  <span className="font-extrabold text-[#008751] font-['Outfit'] text-sm">
                    ₦5,000.00
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#008751] hover:bg-[#007345] text-white font-['Outfit'] font-black text-sm shadow-md flex items-center justify-center gap-2 transition transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Enter FUNAAB Campus</span>
                </button>
              </form>
            ) : (
              /* Persistent Account Form (Supabase Auth) */
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. Emmanuel"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] placeholder-[#9EA8A1] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition"
                      />
                    </div>

                    {/* Custom College Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                      <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                        College
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition flex items-center justify-between"
                      >
                        <span className="truncate">
                          <strong>{selectedCollegeObj.code}</strong> — {selectedCollegeObj.name}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#66736B] shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E5EAE6] rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                          <div className="p-2 border-b border-[#E5EAE6]">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F9F5] text-xs text-[#17211B]">
                              <Search className="w-3.5 h-3.5 text-[#66736B] shrink-0" />
                              <input
                                type="text"
                                value={collegeSearch}
                                onChange={(e) => setCollegeSearch(e.target.value)}
                                placeholder="Search colleges..."
                                className="bg-transparent border-none outline-none w-full text-xs placeholder-[#9EA8A1]"
                                autoFocus
                              />
                            </div>
                          </div>

                          <div className="overflow-y-auto p-1.5 space-y-1">
                            {filteredColleges.map((col) => {
                              const isSelected = col.code === college;
                              return (
                                <button
                                  key={col.code}
                                  type="button"
                                  onClick={() => {
                                    setCollege(col.code);
                                    setIsDropdownOpen(false);
                                    setCollegeSearch('');
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-left text-xs transition flex items-center justify-between ${isSelected ? 'bg-[#E8F5E9] text-[#008751] font-bold' : 'hover:bg-[#F0F4F1] text-[#17211B]'
                                    }`}
                                >
                                  <div>
                                    <span className="font-extrabold">{col.code}</span>
                                    <span className="text-[#66736B] block text-[11px]">{col.name}</span>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-[#008751] shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@funaab.edu.ng"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] placeholder-[#9EA8A1] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17211B] mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] placeholder-[#9EA8A1] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-[#008751] hover:bg-[#007345] text-white font-['Outfit'] font-bold text-sm shadow-md transition transform active:scale-95 mt-2"
                >
                  {isLoading ? 'Processing...' : isSignUp ? 'Create profile' : 'Sign in'}
                </button>

                <div className="text-center pt-2 text-xs text-[#66736B]">
                  {isSignUp ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setIsSignUp(false)}
                        className="text-[#008751] font-bold hover:underline ml-1"
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      New to FUNAAB Life?{' '}
                      <button
                        type="button"
                        onClick={() => setIsSignUp(true)}
                        className="text-[#008751] font-bold hover:underline ml-1"
                      >
                        Create account
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#66736B] border-t border-[#E5EAE6]">
        <div>FUNAAB Life • Built for Abeokuta Students</div>
        <div className="flex items-center gap-3 mt-2 sm:mt-0 font-medium">
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
