import React, { useState, useRef, useEffect } from 'react';
import { ECONOMY_CONFIG, formatNaira } from '../config/economy';
import { useAuthStore } from '../stores/authStore';
import { useInviteStore, inviteOwner } from '../stores/inviteStore';
import worldData from '../config/campusWorld';
import type { CampusSummary } from '../config/campusSummary';
import { networkManager } from '../game/multiplayer/networkManager';
import {
  Users, ChevronDown, Check, Search, Play, ArrowRight, Map as MapIcon, MessageCircle, Wallet,
  GraduationCap, Home, Trophy, UserPlus, Footprints,
} from 'lucide-react';

// In-game screenshots, captured with `npm run screens:landing` (scripts/capture-landing-screenshots.ts).
const SCREENS = {
  hero: '/images/screens/campus-wide.jpg',
  phone: '/images/screens/campus.jpg',
  gallery: [
    { src: '/images/screens/map.jpg', title: 'Live campus map', text: 'See who is on campus and find your friends.' },
    { src: '/images/screens/friends.jpg', title: 'Friends & DMs', text: 'Add friends, message them and send naira.' },
    { src: '/images/screens/keke.jpg', title: 'Ride a keke', text: 'Hop on and ride to any college or hostel.' },
    { src: '/images/screens/earn.jpg', title: 'Earn money', text: 'Hustles, jobs and a daily allowance.' },
  ],
};

const FEATURES = [
  { icon: Footprints, title: 'Walk real FUNAAB', text: 'Colleges, hostels, Car Park, the Library and Sports Centre, laid out like the real campus.' },
  { icon: MessageCircle, title: 'Meet students', text: 'Chat with people near you, add friends, start group chats and DMs.' },
  { icon: GraduationCap, title: 'Attend lectures', text: 'Pick your course, follow your timetable and sit in class with your coursemates.' },
  { icon: Home, title: 'Hostel life', text: 'Rent a room, decorate it, invite friends over and run a room shop.' },
  { icon: Wallet, title: 'Campus economy', text: 'A naira wallet: take jobs, run hustles, buy food and pay keke fares.' },
  { icon: Trophy, title: 'Games & sports', text: 'Football, basketball, PS matches, the College League and game nights.' },
];

const STEPS = [
  { title: 'Create your profile', text: 'Pick a username and your college. It takes a few seconds.' },
  { title: 'Get admitted', text: 'Choose your course, style your avatar and get your matric number.' },
  { title: 'Step onto campus', text: `Start with ${formatNaira(ECONOMY_CONFIG.STARTER_BALANCE)} and explore with everyone online.` },
];

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** A screenshot in a phone frame. */
const PhoneShot: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
  <div className={`rounded-[2rem] bg-[#17211B] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.18)] ${className}`}>
    <img src={src} alt={alt} loading="lazy" width={390} height={844} className="block w-full h-auto rounded-[1.6rem]" />
  </div>
);

/** College picker shared by the guest and sign-up forms. */
const CollegePicker: React.FC<{ value: string; onChange: (code: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selected = worldData.colleges.find((c) => c.code === value) || worldData.colleges[0];
  const filtered = worldData.colleges.filter(
    (c) => c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-bold text-[#17211B] mb-1.5">College</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition flex items-center justify-between"
      >
        <span className="truncate">
          <strong>{selected.code}</strong> — {selected.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-[#66736B] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E5EAE6] rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-[#E5EAE6]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F9F5] text-xs text-[#17211B]">
              <Search className="w-3.5 h-3.5 text-[#66736B] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search colleges..."
                className="bg-transparent border-none outline-none w-full text-xs placeholder-[#9EA8A1]"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto p-1.5 space-y-1">
            {filtered.map((col) => {
              const isSelected = col.code === value;
              return (
                <button
                  key={col.code}
                  type="button"
                  onClick={() => {
                    onChange(col.code);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left text-xs transition flex items-center justify-between ${isSelected ? 'bg-[#E8F5E9] text-[#008751] font-bold' : 'hover:bg-[#F0F4F1] text-[#17211B]'}`}
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
  );
};

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#E5EAE6] text-[#17211B] placeholder-[#9EA8A1] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/15 text-sm font-medium transition';

export const LandingPage: React.FC = () => {
  const { guestLogin, login, signup, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [college, setCollege] = useState('COLENG');
  const isGuestModeEnabled = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
  const [isAuthMode, setIsAuthMode] = useState(!isGuestModeEnabled);
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Off by default: students choose to get event emails.
  const [emailOptIn, setEmailOptIn] = useState(false);
  // Who is on campus right now; hidden when the server can't be reached.
  const [summary, setSummary] = useState<CampusSummary | null>(null);

  // Arrived through a friend's invite link: say who, so the sign-up feels personal.
  const inviteCode = useInviteStore((s) => s.pending);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  useEffect(() => {
    if (!inviteCode) return;
    let live = true;
    inviteOwner(inviteCode).then((name) => { if (live) setInvitedBy(name); });
    return () => { live = false; };
  }, [inviteCode]);

  useEffect(() => {
    const controller = new AbortController();
    networkManager.campusSummary(controller.signal).then(setSummary).catch(() => setSummary(null));
    return () => controller.abort();
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
      await signup(username, college, email, password, emailOptIn);
    } else {
      await login(email, password);
    }
  };

  const goToJoin = (signUp: boolean) => {
    setIsSignUp(signUp);
    scrollToId('join');
  };

  const online = summary && summary.studentsOnline > 0 ? summary : null;

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden w-full bg-[#F7F9F5] text-[#17211B] font-['Plus_Jakarta_Sans']">
      {/* Subtle Background Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#15B86A]/5 blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-[#008751]/4 blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-30 w-full bg-[#F7F9F5]/85 backdrop-blur-md border-b border-[#E5EAE6]/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#008751] flex items-center justify-center text-white text-lg shadow-sm shrink-0">🎓</div>
            <span className="font-['Outfit'] font-black text-lg sm:text-xl tracking-tight whitespace-nowrap">
              FUNAAB <span className="text-[#008751]">Life</span>
            </span>
            <span className="hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#008751] border border-[#C8E6C9] uppercase tracking-wider">
              Beta
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#66736B]">
            <button type="button" onClick={() => scrollToId('screens')} className="hover:text-[#008751] transition">Screenshots</button>
            <button type="button" onClick={() => scrollToId('features')} className="hover:text-[#008751] transition">Features</button>
            <button type="button" onClick={() => scrollToId('how')} className="hover:text-[#008751] transition">How it works</button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isGuestModeEnabled && (
              <button
                type="button"
                onClick={() => setIsAuthMode(!isAuthMode)}
                className="px-3 py-1.5 rounded-xl border border-[#E5EAE6] bg-white text-xs font-semibold hover:bg-[#F0F4F1] transition shadow-sm"
              >
                {isAuthMode ? 'Guest Mode' : 'Account Mode'}
              </button>
            )}
            {isAuthMode && (
              <button
                type="button"
                onClick={() => goToJoin(false)}
                className="px-3.5 py-1.5 rounded-xl bg-[#17211B] text-white text-xs font-bold hover:bg-[#2a372f] transition shadow-sm"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero: pitch on the left, sign-up on the right */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-10 grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        <div className="lg:col-span-7 space-y-5 lg:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-[#008751] text-xs font-bold">
              Built for FUNAAB students
            </span>
            {online && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E5EAE6] text-xs font-semibold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#15B86A] animate-pulse" />
                {online.studentsOnline} on campus now
              </span>
            )}
          </div>

          <h1 className="font-['Outfit'] font-black text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.08]">
            Step onto campus. <br />
            <span className="text-[#008751]">Meet real students.</span>
          </h1>

          <p className="text-[#66736B] text-base lg:text-lg max-w-xl leading-relaxed">
            A 3D, multiplayer FUNAAB in your browser. Walk the campus, take a keke, attend lectures, run a hustle and hang out with
            students from every college.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => goToJoin(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#008751] hover:bg-[#007345] text-white font-['Outfit'] font-bold text-sm shadow-md transition active:scale-95"
            >
              {isAuthMode ? 'Create free profile' : 'Enter campus'} <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollToId('screens')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#E5EAE6] font-['Outfit'] font-bold text-sm shadow-sm hover:bg-[#F0F4F1] transition"
            >
              <Play className="w-4 h-4 text-[#008751]" /> See the campus
            </button>
          </div>

          {online && online.popular.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#66736B]">
              <span className="font-semibold text-[#17211B]">Busy right now:</span>
              {online.popular.map((p) => (
                <span key={p.name} className="px-2 py-0.5 rounded-lg bg-white border border-[#E5EAE6] text-[#17211B]">
                  {p.name} <strong className="text-[#008751]">· {p.count}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Hero screenshot: the campus on a laptop with the phone view in front */}
          <div className="relative pt-4 pr-10 sm:pr-20">
            <div className="rounded-2xl overflow-hidden border border-[#E5EAE6] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#E5EAE6] bg-[#F7F9F5]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                <span className="ml-2 text-[10px] text-[#9EA8A1] font-medium truncate">FUNAAB Life — Ceremonial Main Gate</span>
              </div>
              <img src={SCREENS.hero} alt="Students standing at the FUNAAB main gate in the game" width={1280} height={760} className="block w-full h-auto" />
            </div>
            <PhoneShot src={SCREENS.phone} alt="The game on a phone" className="absolute -bottom-6 right-0 w-24 sm:w-36 rotate-3" />
          </div>
        </div>

        {/* Sign-up / sign-in card */}
        <div id="join" className="lg:col-span-5 lg:sticky lg:top-20 scroll-mt-20">
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#E5EAE6] shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            <div className="mb-6">
              <h2 className="font-['Outfit'] font-black text-2xl tracking-tight">
                {isAuthMode ? (isSignUp ? 'Create your student profile' : 'Welcome back') : 'Instant Campus Entry'}
              </h2>
              <p className="text-xs sm:text-sm text-[#66736B] mt-1">
                {isAuthMode
                  ? isSignUp
                    ? 'Join FUNAAB Life in a few seconds.'
                    : 'Enter your credentials to step back onto campus.'
                  : 'Hop directly into the campus as a guest.'}
              </p>
            </div>

            {invitedBy && isSignUp && (
              <div className="p-3 mb-5 rounded-xl bg-[#E8F5E9] border border-[#C8E6C9] text-[#0B5D36] text-xs font-semibold">
                🤝 @{invitedBy} invited you. Sign up and you'll be campus friends straight away.
              </div>
            )}

            {error && (
              <div className="p-3 mb-5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">{error}</div>
            )}

            {!isAuthMode ? (
              /* Instant Quick Enter Form (Guest Dev Mode) */
              <form onSubmit={handleQuickEnter} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5">Username / Nickname</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Emmanuel"
                    maxLength={20}
                    className={inputClass}
                  />
                </div>

                <CollegePicker value={college} onChange={setCollege} />

                <div className="p-3 rounded-xl bg-[#F7F9F5] border border-[#E5EAE6] flex items-center justify-between text-xs">
                  <span className="text-[#66736B]">Starting Balance:</span>
                  <span className="font-extrabold text-[#008751] font-['Outfit'] text-sm">{formatNaira(ECONOMY_CONFIG.STARTER_BALANCE)}.00</span>
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
                      <label className="block text-xs font-bold mb-1.5">Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. Emmanuel"
                        required
                        className={inputClass}
                      />
                    </div>

                    <CollegePicker value={college} onChange={setCollege} />
                  </>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="youremail@gmail.com"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={inputClass}
                  />
                </div>

                {isSignUp && (
                  <>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs leading-relaxed">
                      <input
                        type="checkbox"
                        checked={emailOptIn}
                        onChange={(e) => setEmailOptIn(e.target.checked)}
                        className="mt-0.5 w-4 h-4 shrink-0 accent-[#008751]"
                      />
                      <span>Email me about College League results, Game Nights and campus events. You can unsubscribe at any time.</span>
                    </label>
                    <p className="text-[11px] text-[#66736B] leading-relaxed">
                      We use your email to run your account. We never sell it or share it with advertisers.
                    </p>
                  </>
                )}

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
                      <button type="button" onClick={() => setIsSignUp(false)} className="text-[#008751] font-bold hover:underline ml-1">
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      New to FUNAAB Life?{' '}
                      <button type="button" onClick={() => setIsSignUp(true)} className="text-[#008751] font-bold hover:underline ml-1">
                        Create account
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screens" className="relative z-10 scroll-mt-16 py-12 sm:py-16 bg-white border-y border-[#E5EAE6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-8">
            <div className="text-xs font-bold uppercase tracking-wider text-[#008751] mb-2">Inside the game</div>
            <h2 className="font-['Outfit'] font-black text-3xl sm:text-4xl tracking-tight">Made for your phone</h2>
            <p className="text-[#66736B] mt-2">Everything works with one thumb: move with the joystick, tap to talk, ride and pay.</p>
          </div>
          <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {SCREENS.gallery.map((s) => (
              <figure key={s.src} className="snap-start shrink-0 w-[62%] sm:w-[40%] lg:w-auto">
                <PhoneShot src={s.src} alt={s.title} />
                <figcaption className="mt-3">
                  <div className="font-['Outfit'] font-bold text-sm">{s.title}</div>
                  <div className="text-xs text-[#66736B] mt-0.5">{s.text}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl mb-8">
          <div className="text-xs font-bold uppercase tracking-wider text-[#008751] mb-2">What you can do</div>
          <h2 className="font-['Outfit'] font-black text-3xl sm:text-4xl tracking-tight">Student life, all in one place</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-5 rounded-2xl bg-white border border-[#E5EAE6] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] text-[#008751] flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <div className="font-['Outfit'] font-bold">{title}</div>
              <div className="text-sm text-[#66736B] mt-1 leading-relaxed">{text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
        <div className="rounded-3xl bg-[#17211B] text-white p-6 sm:p-10">
          <div className="text-xs font-bold uppercase tracking-wider text-[#15B86A] mb-2">How it works</div>
          <h2 className="font-['Outfit'] font-black text-3xl sm:text-4xl tracking-tight">On campus in under a minute</h2>
          <ol className="grid md:grid-cols-3 gap-4 mt-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#15B86A] text-[#17211B] font-['Outfit'] font-black flex items-center justify-center mb-3">{i + 1}</div>
                <div className="font-['Outfit'] font-bold">{s.title}</div>
                <div className="text-sm text-white/65 mt-1">{s.text}</div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <button
              type="button"
              onClick={() => goToJoin(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#15B86A] hover:bg-[#12a35e] text-[#17211B] font-['Outfit'] font-black text-sm transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" /> {isAuthMode ? 'Create free profile' : 'Enter campus'}
            </button>
            <span className="inline-flex items-center gap-2 text-xs text-white/60">
              <Users className="w-4 h-4" /> Free to play · <MapIcon className="w-4 h-4" /> Works on phone and laptop
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#66736B] border-t border-[#E5EAE6]">
        <div>FUNAAB Life • An independent student project, not affiliated with FUNAAB</div>
        <div className="flex items-center gap-3 font-medium">
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
