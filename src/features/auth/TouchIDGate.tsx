import React, { useEffect, useState } from 'react';
import { Button, IconButton } from '@/ui/Button';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/data/firebase';
import {
  getStoredCredentialIds,
  registerTouchID,
  verifyTouchID,
  isBiometricSupported,
} from '@/data/webauthn';
import { requestDeviceCode, verifyDeviceCode } from '@/data/deviceAuth';
import { IconSun as Sun, IconMoon as Moon } from '@/ui/icons';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { FINGERPRINT_ICON } from '@/ui/sketchIcons.data';

interface Props {
  user: User;
  onCleared: () => void;
}

type Stage = 'checking' | 'register' | 'verify' | 'get_code' | 'enter_code' | 'error';

// The hand-drawn fingerprint; its line boils while Touch ID is being asked for.
const FingerprintVector: React.FC<{ scanning?: boolean }> = ({ scanning = false }) => (
  <SketchSvg size={52}>
    <Boil frames={FINGERPRINT_ICON.frames} paused={!scanning} />
  </SketchSvg>
);

export const TouchIDGate: React.FC<Props> = ({ user, onCleared }) => {
  const [stage, setStage] = useState<Stage>('checking');
  const [credentialIds, setCredentialIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark-theme'));

  const toggleTheme = () => {
    const next = !isDark;
    document.body.classList.toggle('dark-theme', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  useEffect(() => {
    async function init() {
      if (!isBiometricSupported()) {
        setErrorMsg('This browser does not support Touch ID.');
        setStage('error');
        return;
      }
      try {
        const ids = await getStoredCredentialIds(user.uid);
        setCredentialIds(ids);
        setStage(ids.length === 0 ? 'register' : 'verify');
      } catch {
        setErrorMsg('Failed to connect. Check your connection.');
        setStage('error');
      }
    }
    init();
  }, [user.uid]);

  const handleRegister = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await registerTouchID(user.uid, user.email ?? user.uid);
      onCleared();
    } catch (e) {
      setErrorMsg(
        (e as { name?: string })?.name === 'NotAllowedError'
          ? 'Cancelled. Try again.'
          : 'Registration failed. Make sure Touch ID is enabled.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const result = await verifyTouchID(credentialIds);
      if (result === 'ok') {
        onCleared();
      } else if (result === 'not_registered') {
        // No credential for this domain — switch to register mode
        setCredentialIds([]);
        setStage('register');
      } else {
        setErrorMsg('Wrong fingerprint. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGetCode = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      await requestDeviceCode(user.uid);
      setStage('enter_code');
    } catch {
      setErrorMsg('Failed to request code. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!codeInput.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      const valid = await verifyDeviceCode(user.uid, codeInput);
      if (valid) {
        setStage('register');
        setCodeInput('');
      } else {
        setErrorMsg('Wrong or expired code. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">

      <IconButton
        tone="ghost"
        onClick={toggleTheme}
        className="absolute top-5 right-5 z-20"
        data-tip={isDark ? 'Switch to light' : 'Switch to dark'}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </IconButton>

      <div className="w-full max-w-md card p-10 md:p-12 relative z-10 text-center">

        {/* Animated fingerprint icon */}
        <div className="flex justify-center mb-8">
          <div
            className="w-14 h-14 flex items-center justify-center text-ink"
          >
            <FingerprintVector scanning={stage === 'verify' || stage === 'register' || busy} />
          </div>
        </div>

        {/* Title */}
        <div className="mb-10">
          <h1 className="text-silver mx-auto text-3xl font-black uppercase tracking-tight">
            {stage === 'checking'   && 'CHECKING…'}
            {stage === 'register'   && 'REGISTER TOUCH ID'}
            {stage === 'verify'     && 'TOUCH ID REQUIRED'}
            {stage === 'get_code'   && 'GET ACCESS CODE'}
            {stage === 'enter_code' && 'ENTER CODE'}
            {stage === 'error'      && 'ACCESS DENIED'}
          </h1>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="bg-rust/10 border border-rust text-rust text-[11px] font-black px-4 py-3 mb-8 rounded-box">
            {errorMsg}
          </div>
        )}

        {/* CTA */}
        {stage === 'checking' && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
          </div>
        )}

        {(stage === 'register' || stage === 'verify') && (
          <Button onClick={stage === 'register' ? handleRegister : handleVerify} disabled={busy} className="w-full">
            {busy
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : stage === 'register' ? 'REGISTER ON THIS DEVICE' : 'AUTHENTICATE'
            }
          </Button>
        )}

        {stage === 'verify' && !busy && (
          <Button tone="ghost" size="sm" onClick={() => { setStage('get_code'); setErrorMsg(''); }} className="mt-4">
            No passkey on this device? Get a code
          </Button>
        )}

        {stage === 'get_code' && (
          <>
            <p className="text-[11px] font-mono-main text-ink/50 mb-6 leading-relaxed">
              Open your trusted device (Mac), then click the button below. A 6-digit code will appear there.
            </p>
            <Button onClick={handleGetCode} disabled={busy} className="w-full">
              {busy
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'SEND CODE TO MY MAC'
              }
            </Button>
          </>
        )}

        {stage === 'enter_code' && (
          <>
            <p className="text-[11px] font-mono-main text-ink/50 mb-4 leading-relaxed">
              Enter the 6-digit code shown on your Mac.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full border border-ink/14 focus:border-ink bg-transparent rounded-box text-center text-3xl font-black font-mono-main tracking-[0.3em] py-3 mb-4 outline-none"
            />
            <Button onClick={handleVerifyCode} disabled={busy || codeInput.length < 6} className="w-full">
              {busy
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'VERIFY CODE'
              }
            </Button>
          </>
        )}

        {stage !== 'checking' && (
          <Button tone="ghost" size="sm" onClick={handleLogout} className="mt-6">
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
};
