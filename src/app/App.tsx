import React, { Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Home } from '@/features/home/Home';
import { Login } from '@/features/auth/Login';
import { TouchIDGate } from '@/features/auth/TouchIDGate';
import { NoAccess } from '@/features/auth/NoAccess';
import { GuestCodeGate } from '@/features/auth/GuestCodeGate';
import { GuestCodeBanner } from '@/features/auth/GuestCodeBanner';
import { GuestEntered } from '@/features/auth/GuestEntered';
import { PausedScreen } from '@/features/auth/PausedScreen';
import { useSystemStatus } from '@/data/useSystemStatus';
import { signOutUser } from '@/data/auth';
import { CustomCursor } from '@/ui/CustomCursor';
import { TooltipLayer } from '@/ui/TooltipLayer';
import { FloatingTimer } from '@/features/focus/FloatingTimer';
import { AuthProvider, useAuth } from '@/features/auth/useAuth';
import { PomodoroProvider } from '@/data/usePomodoro';
import { WorkProvider } from '@/data/useWork';
import { DailyResetManager } from '@/app/DailyResetManager';
import { GoldPriceRefresher } from '@/app/GoldPriceRefresher';
import { DeviceCodeBanner } from '@/features/auth/DeviceCodeBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING } from '@/ui/springPose';
import { usePressHold } from '@/ui/usePressHold';
import { Water, Pomodoro, Finance, WorkHub, Tasks, Projects, Notes, NotePage, Activity, ProjectPage, preloadPages } from '@/app/pages';
import '@/styles/global.css';

const AnimatedPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    // The old page only fades (and quickly): AnimatePresence waits for every exit animation, and a spring to y: -15 took about half
    // a second to settle before the next page could even start. The new page still arrives on the system's spring.
    exit={{ opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } }}
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

  // Hamed can pause Haus for every guest; a guest's screen follows his switch live.
  const system = useSystemStatus(role === 'guest');

  const nav = (to: string, replace = false) => {
    const path = to === 'home' ? '/' : `/${to}`;
    navigate(path, { replace });
  };

  // Derive current page from location
  const currentPage = location.pathname.replace('/', '') || 'home';

  // Once someone is in and the first screen is up, the other pages' code is fetched in the background.
  const signedInAs = user ? role : 'none';
  useEffect(() => { if (signedInAs === 'owner' || signedInAs === 'guest') preloadPages(signedInAs === 'owner'); }, [signedInAs]);

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

  // Paused by Hamed: a guest (whatever else they were about to see) gets the resting page, and it lifts by itself.
  if (role === 'guest' && system.paused) {
    return (
      <div className="min-h-screen">
        <CustomCursor />
        <PausedScreen message={system.message} onSignOut={() => signOutUser()} />
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

  const routes = (
    // The page goes back to the top once the old one has gone — not in a long smooth scroll beside the swap.
    <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })}>
      <Routes>
        <Route path="/" element={<AnimatedPage><Home navigate={nav} viewer={{ role, firstName, photoUrl: user.photoURL }} /></AnimatedPage>} />
        <Route path="/water" element={<AnimatedPage><Water navigate={nav} /></AnimatedPage>} />
        <Route path="/pomodoro" element={<AnimatedPage><Pomodoro navigate={nav} /></AnimatedPage>} />
        {/* The work side is for everyone let in (a guest sees what is shared with them); finance is Hamed's alone. */}
        <Route path="/work" element={<AnimatedPage><WorkHub navigate={nav} author={firstName} authorPhoto={user.photoURL} /></AnimatedPage>} />
        <Route path="/work/tasks" element={<AnimatedPage><Tasks navigate={nav} author={firstName} authorPhoto={user.photoURL} /></AnimatedPage>} />
        <Route path="/work/projects" element={<AnimatedPage><Projects navigate={nav} author={firstName} authorPhoto={user.photoURL} /></AnimatedPage>} />
        <Route path="/work/projects/:id" element={<AnimatedPage><ProjectPage navigate={nav} author={firstName} authorPhoto={user.photoURL} /></AnimatedPage>} />
        {role === 'owner' && <Route path="/work/activity" element={<AnimatedPage><Activity navigate={nav} /></AnimatedPage>} />}
        <Route path="/work/notes" element={<AnimatedPage><Notes navigate={nav} /></AnimatedPage>} />
        <Route path="/work/notes/:id" element={<AnimatedPage><NotePage navigate={nav} /></AnimatedPage>} />
        {role === 'owner' && <Route path="/finance" element={<AnimatedPage><Finance navigate={nav} /></AnimatedPage>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <CustomCursor />
      <DailyResetManager />
      {role === 'owner' && <GoldPriceRefresher />}

      {/* The work side's data: all of it for Hamed, a guest's own part for a guest. */}
      <WorkProvider scope={role === 'owner' ? { kind: 'owner' } : { kind: 'guest', uid: user.uid, name: firstName }}>{routes}</WorkProvider>

      <FloatingTimer currentPage={currentPage} onNavigate={() => nav('pomodoro')} />
      {role === 'owner' && <DeviceCodeBanner user={user} />}
      {role === 'owner' && <GuestCodeBanner />}
      {role === 'guest' && <GuestEntered uid={user.uid} name={firstName} />}
    </div>
  );
};

const App: React.FC = () => {
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
