/**
 * The single source for every plain UI icon in the app (play, pause, plus, log out…) — one
 * library (Hugeicons), given a light touch of the hand-drawn style: round, blunt ends and joins. The
 * touch is kept light on purpose: these are controls, read at a glance. They carry no SVG filter: a
 * filter has to be computed whenever the icon is drawn again, and in some browsers that shows as a
 * dark flash. The bigger, characterful icons (the sections, the dock's
 * arrow, sign-in, banks and buckets) are fully hand-drawn instead, in ui/Sketch.tsx.
 * Features import icons from here, never from '@hugeicons/*' directly — that's what makes the
 * library, the stroke width and the line ends each a one-line edit (ICON_STROKE_WIDTH /
 * ICON_STROKE_LINECAP / ICON_STROKE_LINEJOIN below) instead of a find-and-replace across every
 * screen.
 *
 * Exceptions (not built through createIcon, but still import these same constants rather than
 * hardcoding their own): the Pomodoro focus ring (src/ui/TimerComponents.tsx, scales with its own
 * size), Recharts chart internals, and the wordmark.
 */
import React from 'react';
import {
  Refresh01Icon, Undo02Icon, PlusSignIcon, ArrowLeft01Icon, ArrowRight01Icon,
  Sun01Icon, Moon01Icon, Camera01Icon, MoreVerticalIcon, Logout04Icon,
  Money01Icon, Delete02Icon, PencilEdit01Icon,
  PlayIcon, PauseIcon, Login03Icon,
  ArrowDown01Icon, UserGroupIcon, VolumeHighIcon, VolumeOffIcon,
} from '@hugeicons/core-free-icons';

/** Every plain icon is built from these three constants. Change one here and it changes
 *  everywhere, including the exceptions listed above, which import these same constants
 *  instead of hardcoding their own numbers/keywords. */
export const ICON_STROKE_WIDTH = 2;
export const ICON_STROKE_LINECAP = 'round' as const;
export const ICON_STROKE_LINEJOIN = 'round' as const;

type HugeIconData = [string, Record<string, unknown>][];

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/** Renders a Hugeicons path set with the system's line ends. */
function createIcon(data: HugeIconData, displayName: string) {
  const Icon: React.FC<IconProps> = ({ size = 24, className, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {data.map(([tag, attrs], i) =>
        React.createElement(tag, {
          ...attrs,
          key: i,
          stroke: attrs.stroke ? color : undefined,
          strokeWidth: ICON_STROKE_WIDTH,
          strokeLinecap: ICON_STROKE_LINECAP,
          strokeLinejoin: ICON_STROKE_LINEJOIN,
        })
      )}
    </svg>
  );
  Icon.displayName = `Icon(${displayName})`;
  return Icon;
}

export const IconRotateCcw = createIcon(Refresh01Icon as HugeIconData, 'RotateCcw');
export const IconUndo2 = createIcon(Undo02Icon as HugeIconData, 'Undo2');
export const IconPlus = createIcon(PlusSignIcon as HugeIconData, 'Plus');
export const IconArrowLeft = createIcon(ArrowLeft01Icon as HugeIconData, 'ArrowLeft');
export const IconChevronRight = createIcon(ArrowRight01Icon as HugeIconData, 'ChevronRight');
export const IconSun = createIcon(Sun01Icon as HugeIconData, 'Sun');
export const IconMoon = createIcon(Moon01Icon as HugeIconData, 'Moon');
export const IconCamera = createIcon(Camera01Icon as HugeIconData, 'Camera');
export const IconMoreVertical = createIcon(MoreVerticalIcon as HugeIconData, 'MoreVertical');
export const IconLogOut = createIcon(Logout04Icon as HugeIconData, 'LogOut');
export const IconBanknote = createIcon(Money01Icon as HugeIconData, 'Banknote');
export const IconTrash2 = createIcon(Delete02Icon as HugeIconData, 'Trash2');
export const IconPencil = createIcon(PencilEdit01Icon as HugeIconData, 'Pencil');
export const IconPlay = createIcon(PlayIcon as HugeIconData, 'Play');
export const IconPause = createIcon(PauseIcon as HugeIconData, 'Pause');
export const IconLogin = createIcon(Login03Icon as HugeIconData, 'Login');
export const IconVolume = createIcon(VolumeHighIcon as HugeIconData, 'Volume');
export const IconVolumeOff = createIcon(VolumeOffIcon as HugeIconData, 'VolumeOff');
export const IconUsers = createIcon(UserGroupIcon as HugeIconData, 'Users');
export const IconChevronDown = createIcon(ArrowDown01Icon as HugeIconData, 'ChevronDown');
