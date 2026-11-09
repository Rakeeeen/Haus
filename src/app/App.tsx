import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Home } from '@/features/home/Home';
import { Login } from '@/features/auth/Login';
import { TouchIDGate } from '@/features/auth/TouchIDGate';
import { NoAccess } from '@/features/auth/NoAccess';
import { GuestCodeGate } from '@/features/auth/GuestCodeGate';
import { GuestCodeBanner } from '@/features/auth/GuestCodeBanner';
import { CustomCursor } from '@/ui/CustomCursor';
import { TooltipLayer } from '@/ui/TooltipLayer';
import { FloatingTimer } from '@/features/focus/FloatingTimer';
import { AuthProvider, useAuth } from '@/features/auth/useAuth';
import { PomodoroProvider } from '@/data/usePomodoro';
import { DailyResetManager } from '@/app/DailyResetManager';
import { GoldPriceRefresher } from '@/app/GoldPriceRefresher';
import { DeviceCodeBanner } from '@/features/auth/DeviceCodeBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { usePressHold } from '@/ui/usePressHold';
import '@/styles/global.css';

// The other pages load when they are first opened, so the first screen doesn't carry the charts
// (Recharts) and everything Finance needs.
const Water = lazy(() => import('@/features/water/Water').then((m) => ({ default: m.Water })));
const Pomodoro = lazy(() => import('@/features/focus/Pomodoro').then((m) => ({ default: m.Pomodoro })));
const Finance = lazy(() => import('@/features/finance/Finance').then((m) => ({ default: m.Finance })));

const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    transition={{ ...SPRING, opacity: { duration: 0.2 } }}
    className="w-full"
  >
    <Suspense fallback={null}>{children}</Suspense>
  </motion.div>
);
const AppRoutes: React.FC = () => {
  usePressHold();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, firstName, approved, accessError, biometricCleared, setBiometricCleared } = useAuth();

  const nav = (to: string) => {
    const path = to === 'home' ? '/' : `/${to}`;
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Derive current page from location
  const currentPage = location.pathname.replace('/', '') || 'home';

  if (!user) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <Login />
      </div>
    );
  }

  // Signed in with Google but not invited (or the invitation couldn't be checked): nothing is loaded.
  if (role === 'none') {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <NoAccess user={user} error={accessError} />
      </div>
    );
  }

  // An invited guest has no fingerprint here: a code Hamed gives them lets them in.
  if (role === 'guest' && !approved) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <GuestCodeGate user={user} />
      </div>
    );
  }

  // The fingerprint is Hamed's alone.
  if (role === 'owner' && !biometricCleared) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <TouchIDGate user={user} onCleared={() => setBiometricCleared(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <CustomCursor />
      <DailyResetManager />
      {role === 'owner' && <GoldPriceRefresher />}

      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<AnimatedPage><Home navigate={nav} viewer={{ role, firstName, photoUrl: user.photoURL }} /></AnimatedPage>} />
          <Route path="/water" element={<AnimatedPage><Water navigate={nav} /></AnimatedPage>} />
          <Route path="/pomodoro" element={<AnimatedPage><Pomodoro navigate={nav} /></AnimatedPage>} />
          {/* Finance is Hamed's alone. */}
          {role === 'owner' && <Route path="/finance" element={<AnimatedPage><Finance navigate={nav} /></AnimatedPage>} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>

      <FloatingTimer currentPage={currentPage} onNavigate={() => nav('pomodoro')} />
      {role === 'owner' && <DeviceCodeBanner user={user} />}
      {role === 'owner' && <GuestCodeBanner />}
    </div>
  );
};

const App: React.FC = () => {
  // Toggles `.is-scrolling` on <html> while any scrollable element (window or a nested
  // overflow container) is actively being scrolled, then removes it after a short idle
  // pause — the scrollbar thumb CSS shows/hides based on this class.
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      document.documentElement.classList.add('is-scrolling');
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 700);
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TooltipLayer />
      <AuthProvider>
        <PomodoroProvider>
          <AppRoutes />
        </PomodoroProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
