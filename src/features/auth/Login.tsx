import React, { useState } from 'react';
import { Button, IconButton } from '@/ui/Button';
import { signInWithGoogle } from '@/data/auth';
import { isDarkTheme, setTheme } from '@/lib/theme';
import { IconLogin, IconSun as Sun, IconMoon as Moon } from '@/ui/icons';
import { Boil, SketchSvg } from '@/ui/Sketch';
import { LOCK_ICON } from '@/ui/sketchIcons.data';

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDark, setIsDark] = useState(isDarkTheme);

  const toggleTheme = () => {
    setTheme(!isDark);
    setIsDark(!isDark);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      // Whether this account may come in is decided after sign-in (an invited guest, or the owner).
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError('Login failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300">
      {/* Theme toggle */}
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
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 flex items-center justify-center text-ink">
            <SketchSvg size={52}><Boil frames={LOCK_ICON.frames} /></SketchSvg>
          </div>
        </div>
        
        <div className="mb-10">
          <h1 className="text-silver mx-auto text-3xl font-black uppercase tracking-tight">Vault gatekeeper</h1>
        </div>

        {error && (
          <div className="bg-rust/10 border border-rust text-rust text-[11px] font-black px-4 py-3 mb-8 rounded-box">
             {error}
          </div>
        )}

        <Button onClick={handleGoogleLogin} disabled={loading} className="w-full">
          {loading ? (
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <IconLogin size={20} />
              <span>CONTINUE WITH GOOGLE</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
