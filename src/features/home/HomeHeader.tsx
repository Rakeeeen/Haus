import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { IconButton } from '@/ui/Button';
import { IconCamera as Camera, IconLogOut as LogOut, IconMoon as Moon, IconMoreVertical as MoreVertical, IconPause as Pause, IconPlay as Play, IconSun as Sun, IconUsers as Users } from '@/ui/icons';
import { SPRING } from '@/ui/springPose';
import { useDismiss } from '@/ui/useDismiss';
import { AchievementRow } from '@/features/home/components/AchievementRow';
import type { GreetingParts } from '@/features/home/useGreeting';

/** The top line: the greeting (or the evening's journal line), then the profile picture and the menu. */
export const HomeHeader: React.FC<{
  greeting: GreetingParts;
  greetingVisible: boolean;
  /** The evening journal line; it replaces the greeting while it shows. */
  journalEntry: string | null;
  onNameClick: () => void;
  /** The picture to show (null: the first letter), and whether a new one is uploading. */
  photoUrl: string | null;
  initial: string;
  uploading: boolean;
  /** Hamed changes his picture by pressing it; a guest has none to press (theirs is their Google photo). */
  onAvatarClick?: () => void;
  isOwner: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenGuests: () => void;
  /** Hamed's switch for pausing Haus for every guest: `paused` is its state, `onTogglePause` asks to pause (or resumes at once). */
  paused?: boolean;
  onTogglePause?: () => void;
  onLogout: () => void;
}> = ({ greeting, greetingVisible, journalEntry, onNameClick, photoUrl, initial, uploading, onAvatarClick, isOwner, isDark, onToggleTheme, onOpenGuests, paused = false, onTogglePause, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(showMenu, () => setShowMenu(false), [menuRef]);

  return (
    <header className="w-full max-w-[1400px] mx-auto mb-6 md:mb-12 lg:mb-16 flex flex-row items-center justify-between gap-4 border-b border-ink/10 pb-4 md:pb-6">
      <div>
        <h1
          className="font-sans-main text-lg sm:text-xl md:text-2xl tracking-tight select-none"
          style={{ color: 'color-mix(in srgb, var(--ink) 55%, transparent)', opacity: greetingVisible ? 1 : 0, transition: 'opacity 0.5s ease' }}
        >
          {journalEntry ? (
            <span className="font-light">{journalEntry}</span>
          ) : (
            <>
              {greeting.achievement && <AchievementRow achievement={greeting.achievement} />}
              <span className="font-light">{greeting.before}</span>
              <span className="font-medium cursor-pointer" onClick={onNameClick} style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 20%, transparent)' }}>{greeting.name}</span>
              <span className="font-light">{greeting.after}</span>
            </>
          )}
        </h1>
      </div>

      <div className="flex items-center gap-4 relative" ref={menuRef}>
        <div
          onClick={onAvatarClick}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-ink bg-paper-dark relative overflow-hidden group flex items-center justify-center ${onAvatarClick ? 'cursor-pointer' : ''}`}
        >
          {uploading ? (
            <div className="text-[8px] font-mono-main font-bold animate-pulse text-ink/80 text-center">Syncing</div>
          ) : photoUrl ? (
            <>
              <img src={photoUrl} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              {onAvatarClick && (
                <div className="absolute inset-0 bg-paper-dark/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={14} className="text-ink" />
                </div>
              )}
            </>
          ) : (
            <span className="text-xl font-black font-sans-main text-ink/30">{initial}</span>
          )}
        </div>

        <div className="relative">
          <IconButton onClick={() => setShowMenu((v) => !v)} className="!w-12 !h-12 sm:!w-14 sm:!h-14" data-tip="Menu" aria-label="Menu">
            <MoreVertical size={20} />
          </IconButton>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ ...SPRING, opacity: { duration: 0.2 } }}
                className="spring-group absolute right-0 mt-2 z-50 bg-paper-dark border border-ink/14 rounded-full p-1.5 flex items-center gap-1.5"
              >
                <IconButton
                  onClick={onToggleTheme}
                  data-tip={isDark ? 'Switch to Light' : 'Switch to Dark'}
                  aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                  {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </IconButton>

                {/* Guests (Hamed's alone) */}
                {isOwner && (
                  <IconButton onClick={() => { setShowMenu(false); onOpenGuests(); }} data-tip="Guests" aria-label="Guests">
                    <Users size={18} />
                  </IconButton>
                )}

                {/* Pause Haus for every guest (Hamed's alone) */}
                {isOwner && onTogglePause && (
                  <IconButton
                    onClick={() => { setShowMenu(false); onTogglePause(); }}
                    className={paused ? '!text-rust' : ''}
                    data-tip={paused ? 'Haus is paused for guests — resume' : 'Pause Haus for guests'}
                    aria-label={paused ? 'Resume Haus for guests' : 'Pause Haus for guests'}
                  >
                    {paused ? <Play size={18} /> : <Pause size={18} />}
                  </IconButton>
                )}

                <IconButton onClick={onLogout} className="!text-rust" data-tip="Log out" aria-label="Log out">
                  <LogOut size={18} />
                </IconButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};
