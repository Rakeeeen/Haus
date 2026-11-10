import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { NAME } from '@/constants/brand';
import { SPRING, stagePose } from '@/ui/springPose';
import { AppModal } from '@/ui/AppModal';
import { PixelDateTile } from '@/ui/PixelCalendar';
import { useElementHeight, useMediaQuery } from '@/ui/useElementHeight';
import { isDarkTheme, setTheme } from '@/lib/theme';
import { signOutUser } from '@/data/auth';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { useFridayGate } from '@/data/useFridayGate';
import { useGuests } from '@/data/useMembers';
import { usePomodoro } from '@/data/usePomodoro';
import { usePrayer } from '@/data/usePrayer';
import { useWeather } from '@/data/useWeather';
import { forMeOf } from '@/domain/work/whose';
import { useWhoseTasks } from '@/data/useWhoseTasks';
import { useWorkOptional } from '@/data/useWork';
import type { Viewer } from '@/domain/access';
import { getClockParts, HOME_TIME_ZONE } from '@/domain/clock';
import { computeNextPrayer, getDayMoments, isFocusNightLocked, isWaterClosed } from '@/domain/devotion/prayer';
import { getDateParts } from '@/domain/month';
import { filterTasks, sortTasks } from '@/domain/work/tasks';
import { BigCard } from '@/features/home/BigCard';
import { buildDockCards } from '@/features/home/dockCards';
import { Dock } from '@/features/home/Dock';
import { FingerprintModal } from '@/features/home/FingerprintModal';
import { HomeHeader } from '@/features/home/HomeHeader';
import { FinanceCardBody } from '@/features/home/components/FinanceCard';
import { FocusCardBody } from '@/features/home/components/FocusCard';
import { GuestsModal } from '@/features/home/components/GuestsModal';
import { TasksCardBody } from '@/features/home/components/TasksCard';
import { TimeCardBody } from '@/features/home/components/TimeCard';
import { WaterCardBody } from '@/features/home/components/WaterCard';
import { useAvatar } from '@/features/home/useAvatar';
import { useCardSelection } from '@/features/home/useCardSelection';
import { useDailySnapshot } from '@/features/home/useDailySnapshot';
import { useDockTouch } from '@/features/home/useDockTouch';
import { useGreeting } from '@/features/home/useGreeting';
import { useNow } from '@/features/home/useNow';
import { useZenMode } from '@/features/home/useZenMode';

interface HomeProps {
  navigate: (to: string) => void;
  /** Who is looking: the owner sees everything; a guest sees no finance and is greeted by their own name. */
  viewer: Viewer;
}

/** The most glasses of water one day can hold. */
const GLASSES_PER_DAY = 12;

/**
 * Home: the greeting line, the dock of small cards on the left, the big card, and today's date. This file only wires the
 * pieces together — each has a file of its own beside it: `useGreeting`, `useDailySnapshot`, `useCardSelection`,
 * `useZenMode`, `useDockTouch` (the logic), and `HomeHeader`, `Dock`, `BigCard`, `FingerprintModal` (the parts).
 */
export const Home: React.FC<HomeProps> = ({ navigate, viewer }) => {
  const isOwner = viewer.role === 'owner';
  const reduceMotion = useReducedMotion();
  const now = useNow();
  useEffect(() => { document.title = NAME; }, []);

  // ── Data ───────────────────────────────────────────────────────────────────────────────────────
  const [guestsOpen, setGuestsOpen] = useState(false);
  const { guests, statuses: guestStatuses, error: guestsError, invite, setActive, remove } = useGuests(isOwner, guestsOpen);
  const work = useWorkOptional();
  // Whose tasks the card lists is chosen on the Tasks pages (one remembered choice); the card just follows it.
  const [whose] = useWhoseTasks();
  const dueToday = useMemo(
    () => (work ? sortTasks(filterTasks(work.tasks, { day: { kind: 'today' }, statuses: ['todo', 'doing'], forMe: forMeOf(whose, work.me) })) : []),
    [work, whose],
  );
  const projectName = (id: string | null) => work?.projects.find((p) => p.id === id)?.name ?? null;

  const [glasses, setGlasses] = useFirebaseSync<number>('hydration_glasses', 0);
  const [financeBanks] = useFirebaseSync<Record<string, number>>('finance_banks', {});
  const totalPhysical = Object.values(financeBanks).reduce((a, b) => a + (Number(b) || 0), 0);

  const pomodoro = usePomodoro();
  const focusRunning = pomodoro.running || pomodoro.isOvertime;
  const focusMinutes = pomodoro.weekStats?.[pomodoro.todayIdx]?.minutes || 0;
  const focusHours = (focusMinutes / 60).toFixed(1).replace('.0', '');
  const sessionTotalSecs = (pomodoro.mode === 'focus' ? pomodoro.focusDuration : pomodoro.breakDuration) * 60;
  // Started and with progress, but not ticking — different from "never started" (time left equals the whole session).
  const focusPaused = !pomodoro.running && !pomodoro.isOvertime && pomodoro.timeLeft > 0 && pomodoro.timeLeft < sessionTotalSecs;

  const { times, hijriDate } = usePrayer();
  const nextPrayer = useMemo(() => computeNextPrayer(times, now), [times, now]);
  const weather = useWeather();
  const { dailyHistory, todayKey, journalEntry } = useDailySnapshot(glasses, focusMinutes, now);

  // Water closes at the real Maghrib and reopens at the real Fajr; a new focus session can't start between Isha and Fajr
  // (the Pomodoro page enforces the same, and the card's Start button is a second way in).
  const waterLocked = isWaterClosed(times, now);
  const focusNightLocked = isFocusNightLocked(times, now);
  const { friday, includedToday } = useFridayGate(now);
  const focusFridayLocked = friday && !includedToday;
  const beforeFajr = now.getTime() < getDayMoments(times, now).fajr;
  const clock = getClockParts(HOME_TIME_ZONE, now);

  // ── Header ─────────────────────────────────────────────────────────────────────────────────────
  const greeting = useGreeting({
    isOwner,
    guestFirstName: viewer.firstName,
    now,
    glasses,
    focusMinutes,
    session: { mode: pomodoro.mode, running: pomodoro.running, overtime: pomodoro.isOvertime, timeLeft: pomodoro.timeLeft, overtimeSeconds: pomodoro.overtime, totalSecs: sessionTotalSecs },
    times,
    hijriDate,
    nextPrayer,
    weather,
    dailyHistory,
    todayKey,
    journalEntry,
  });
  const avatar = useAvatar();
  const [isDark, setIsDark] = useState(isDarkTheme);
  const toggleTheme = () => { setTheme(!isDark); setIsDark(!isDark); };
  const [showFingerprint, setShowFingerprint] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  // Logging out stops a running focus session, so it asks first.
  const handleLogout = () => (focusRunning ? setLogoutModal(true) : void signOutUser());

  // ── The dock and the big card ──────────────────────────────────────────────────────────────────
  const selection = useCardSelection({ focusRunning, beforeFajr, now });
  const { displayedCardId } = selection;
  const zen = useZenMode({ displayedCardId, focusActive: pomodoro.mode === 'focus' && focusRunning, now });
  const touch = useDockTouch();
  const isLgUp = useMediaQuery('(min-width: 1024px)');
  const stage = stagePose(
    reduceMotion || zen.zenActive ? null : touch.stageTouch,
    reduceMotion || zen.zenActive ? null : touch.pressedCardId ? 'press' : touch.hoveredCardId ? 'hover' : null,
    isLgUp,
  );

  // The big card is as tall as the dock (and, in zen mode, as the whole column), measured, not hardcoded.
  const dockRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const dockHeight = useElementHeight(dockRef);
  const mainHeight = useElementHeight(mainRef);
  // Every mount starts with the dock unmeasured, so the first real height is a snap, not a "grows, then shrinks" on every
  // visit. Set only after that first render has committed, so zen's own height changes (well after mount) still animate.
  const heightSettledRef = useRef(false);
  useEffect(() => { if (dockHeight !== null) heightSettledRef.current = true; }, [dockHeight]);

  const dockCards = buildDockCards({
    isOwner,
    glasses,
    dueToday,
    totalPhysical,
    focus: { running: pomodoro.running, overtime: pomodoro.isOvertime, paused: focusPaused, mode: pomodoro.mode, timeLeft: pomodoro.timeLeft, overtimeSeconds: pomodoro.overtime, minutes: focusMinutes, hours: focusHours },
  });
  const waterFillLevel = Math.min(1, (glasses || 0) / GLASSES_PER_DAY);

  const addWaterCup = (e: React.MouseEvent) => {
    e.stopPropagation(); // not a click on the card (which would open the page)
    if (!waterLocked && glasses < GLASSES_PER_DAY) setGlasses(glasses + 1);
  };

  return (
    <div className="min-h-screen text-ink py-6 md:py-12 px-6 md:px-12 lg:px-20 font-sans-main flex flex-col transition-colors duration-300 relative">
      {/* Hamed picks his own picture; a guest's is the one from their Google account, and can't be changed here. */}
      {isOwner && <input type="file" ref={avatar.fileInputRef} className="hidden" accept="image/*" onChange={avatar.onFileChange} />}

      <HomeHeader
        greeting={greeting.displayed}
        greetingVisible={greeting.visible}
        journalEntry={journalEntry}
        onNameClick={() => setShowFingerprint(true)}
        photoUrl={isOwner ? avatar.avatarUrl : viewer.photoUrl}
        initial={isOwner ? 'R' : viewer.firstName.charAt(0).toUpperCase()}
        uploading={avatar.uploading}
        onAvatarClick={isOwner ? avatar.openPicker : undefined}
        isOwner={isOwner}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenGuests={() => setGuestsOpen(true)}
        onLogout={handleLogout}
      />

      <main
        ref={mainRef}
        className="w-full max-w-[1400px] mx-auto flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8 items-stretch lg:items-start"
      >
        <Dock
          cards={dockCards}
          activeCardId={selection.activeCardId}
          systemCardId={selection.systemCardId}
          zenActive={zen.zenActive}
          isLgUp={isLgUp}
          dockShift={stage.dockShift}
          touch={touch}
          dockRef={dockRef}
          waterFillLevel={waterFillLevel}
          clock={clock}
          totalPhysical={totalPhysical}
          onPick={selection.pickCard}
          // Water is the odd one out: double-click logs a glass instead of opening the page.
          onOpen={(card, e) => (card.id === 'water' ? addWaterCup(e) : card.route ? navigate(card.route) : undefined)}
        />

        <BigCard
          stage={stage}
          isLgUp={isLgUp}
          height={(zen.zenActive ? (mainHeight ?? dockHeight) : dockHeight) ?? 740}
          animateHeight={heightSettledRef.current}
          touch={touch}
          zenActive={zen.zenActive}
          zenEdgeArmed={zen.zenEdgeArmed}
          onExitZen={zen.exitZen}
          visible={selection.bigCardVisible}
          onOpen={() => { const route = dockCards.find((c) => c.id === selection.activeCardId)?.route; if (route) navigate(route); }}
        >
          {displayedCardId === 'water' && (
            <WaterCardBody glasses={glasses} fillLevel={waterFillLevel} locked={waterLocked} onAddGlass={addWaterCup} />
          )}
          {displayedCardId === 'pomodoro' && (
            <FocusCardBody
              running={pomodoro.running}
              overtime={pomodoro.isOvertime}
              paused={focusPaused}
              mode={pomodoro.mode}
              overtimeSeconds={pomodoro.overtime}
              timeLeft={pomodoro.timeLeft}
              totalSecs={sessionTotalSecs}
              onResume={(e) => { e.stopPropagation(); pomodoro.start(); }}
              focusMinutes={focusMinutes}
              focusHours={focusHours}
              nightLocked={focusNightLocked}
              fridayLocked={focusFridayLocked}
              onStart={(e) => { e.stopPropagation(); if (!focusNightLocked && !focusFridayLocked) pomodoro.start(); }}
            />
          )}
          {displayedCardId === 'tasks' && (
            <TasksCardBody today={dueToday} projectName={projectName} onFinish={(task) => work?.setTaskStatus(task, 'done')} />
          )}
          {displayedCardId === 'finance' && <FinanceCardBody totalPhysical={totalPhysical} />}
          {displayedCardId === 'time' && <TimeCardBody clock={clock} />}
        </BigCard>
      </main>

      {/* Today's date, centred in whatever room is left under the big card. It fades with the dock in zen mode, on the same
          spring; it needn't collapse its own height, since zen's height comes from measuring `main`, not from the footer. */}
      <motion.footer
        className="w-full max-w-[1400px] mx-auto flex-1 flex items-center justify-center overflow-hidden pt-6 sm:pt-10"
        initial={false}
        animate={{ opacity: zen.zenActive ? 0 : 1, scale: zen.zenActive ? 0.92 : 1, y: stage.footerShift }}
        transition={{ ...SPRING, opacity: { duration: 0.2 } }}
      >
        <PixelDateTile date={getDateParts(now)} width="clamp(56px, 5.5vw, 76px)" />
      </motion.footer>

      <AppModal
        isOpen={avatar.failed}
        onClose={avatar.dismissFailure}
        title="Upload failed"
        confirm={{ message: 'Something went wrong while uploading your avatar. Please try again.', confirmText: 'Got it', cancelText: 'Dismiss', onConfirm: avatar.dismissFailure }}
      />
      {isOwner && (
        <GuestsModal isOpen={guestsOpen} onClose={() => setGuestsOpen(false)} guests={guests} statuses={guestStatuses} error={guestsError} onInvite={invite} onSetActive={setActive} onRemove={remove} />
      )}
      <AppModal
        isOpen={logoutModal}
        onClose={() => setLogoutModal(false)}
        title="Timer is running"
        confirm={{ message: 'You have an active Pomodoro session. Logging out will stop your timer and unsaved progress will be lost.', confirmText: 'Log out', cancelText: 'Stay', onConfirm: () => { setLogoutModal(false); void signOutUser(); } }}
      />
      <FingerprintModal isOpen={showFingerprint} onClose={() => setShowFingerprint(false)} now={now} dailyHistory={dailyHistory} />
    </div>
  );
};
