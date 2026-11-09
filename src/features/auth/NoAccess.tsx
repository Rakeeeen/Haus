import React from 'react';
import { signOut, type User } from 'firebase/auth';
import { auth } from '@/data/firebase';
import { Button } from '@/ui/Button';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { LOCK_ICON } from '@/ui/sketchIcons.data';

/**
 * Signed in with Google, but not let in: either the owner hasn't invited this email, or the invitation
 * couldn't be checked right now (`error`). Nothing of the system has been loaded for this person.
 */
export const NoAccess: React.FC<{ user: User; error: boolean }> = ({ user, error }) => (
  <div className="min-h-screen flex items-center justify-center p-6">
    <div className="w-full max-w-md card p-10 md:p-12 text-center">
      <div className="flex justify-center mb-8 text-ink">
        <SketchSvg size={52}><Boil frames={LOCK_ICON.frames} /></SketchSvg>
      </div>
      <h1 className="text-silver mx-auto text-3xl font-black uppercase tracking-tight mb-6">
        {error ? 'Can’t check access' : 'Not invited'}
      </h1>
      <p className="font-mono-main text-[11px] leading-relaxed text-ink/60 mb-8 break-words">
        {error
          ? 'Haus couldn’t check your invitation just now. Check your connection and try again.'
          : <>{user.email} isn’t on the guest list. Ask Hamed to invite this email, then sign in again.</>}
      </p>
      <div className="flex flex-col gap-3">
        {error && <Button onClick={() => window.location.reload()} className="w-full">Try again</Button>}
        <Button tone={error ? 'outline' : 'primary'} onClick={() => signOut(auth)} className="w-full">Sign out</Button>
      </div>
    </div>
  </div>
);
