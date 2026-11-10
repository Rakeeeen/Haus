import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/data/firebase';
import { setDataScope } from '@/data/dataScope';
import { fetchInvitation } from '@/data/useMembers';
import { publishGuestProfile, watchGuestApproval } from '@/data/guestAccess';
import { OWNER_UID } from '@/constants/owner';
import { firstNameOf, isApprovalValid, roleOf, type Role } from '@/domain/access';
import { Wordmark } from '@/ui/Wordmark';

interface AuthContextType {
  user: User | null;
  /** owner, an invited guest, or none (signed in with Google but not invited). */
  role: Role;
  /** The first word of the person's Google name — what the header line greets them by. */
  firstName: string;
  /**
   * Whether this person may see the system now: the owner always; a guest once they have typed in a code
   * Hamed gave them (until then they only see the code screen).
   */
  approved: boolean;
  /** The invitation couldn't be checked (offline, say): not the same as "not invited". */
  accessError: boolean;
  loading: boolean;
  biometricCleared: boolean;
  setBiometricCleared: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'none',
  firstName: '',
  approved: false,
  accessError: false,
  loading: true,
  biometricCleared: false,
  setBiometricCleared: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('none');
  const [approved, setApproved] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [biometricCleared, setBiometricClearedState] = useState(
    () => sessionStorage.getItem('biometric_cleared') === 'true'
  );

  useEffect(() => {
    // A guest's approval is watched for as long as they are signed in.
    let stopApproval: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      stopApproval?.();
      stopApproval = null;
      if (!currentUser) {
        setDataScope({ kind: 'none' });
        setUser(null);
        setRole('none');
        setApproved(false);
        setAccessError(false);
        setLoading(false);
        // Reset biometric when user changes (logout / different account)
        sessionStorage.removeItem('biometric_cleared');
        setBiometricClearedState(false);
        return;
      }

      // The owner is known by uid; anyone else is a guest only if the owner invited their email.
      let next: Role = 'none';
      let failed = false;
      if (currentUser.uid === OWNER_UID) {
        next = 'owner';
      } else {
        try {
          next = roleOf(currentUser.uid, OWNER_UID, await fetchInvitation(currentUser.email));
        } catch (error) {
          console.warn('Could not check the invitation:', error);
          failed = true;
        }
      }
      // Set before anything that reads values is shown: it decides where those values live.
      const letIn = (ok: boolean) => {
        setDataScope(next === 'owner' ? { kind: 'owner' } : next === 'guest' && ok ? { kind: 'guest', uid: currentUser.uid } : { kind: 'none' });
        setApproved(ok);
      };
      if (next === 'guest') {
        // Hamed's app learns who this guest is (to share projects with them by name). Best-effort.
        publishGuestProfile(currentUser.uid, currentUser.email ?? '', currentUser.displayName, currentUser.photoURL)
          .catch((error) => console.warn('Could not publish the guest profile:', error));
        // Wait for the first answer, so a guest already let in doesn't flash the code screen.
        await new Promise<void>((resolve) => {
          let first = true;
          stopApproval = watchGuestApproval(currentUser.uid, (approvedAt) => {
            letIn(approvedAt !== null && isApprovalValid(approvedAt, Date.now()));
            if (first) { first = false; resolve(); }
          });
        });
      } else {
        letIn(next === 'owner');
      }
      setUser(currentUser);
      setRole(next);
      setAccessError(failed);
      setLoading(false);
    });
    return () => { stopApproval?.(); unsubscribe(); };
  }, []);

  const setBiometricCleared = (v: boolean) => {
    if (v) sessionStorage.setItem('biometric_cleared', 'true');
    else sessionStorage.removeItem('biometric_cleared');
    setBiometricClearedState(v);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Wordmark className="text-sepia font-black text-2xl animate-pulse" />
      </div>
    );
  }

  const firstName = user ? firstNameOf(user.displayName, user.email) : '';

  return (
    <AuthContext.Provider value={{ user, role, firstName, approved, accessError, loading, biometricCleared, setBiometricCleared }}>
      {/* A new person (or a new role, or a guest just let in) gets a fresh tree, so nothing read before lingers. */}
      <React.Fragment key={`${user?.uid ?? 'anon'}:${role}:${approved}`}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
