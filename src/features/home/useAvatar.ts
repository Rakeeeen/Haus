import { useRef, useState } from 'react';
import { useFirebaseSync } from '@/data/useFirebaseSync';
import { uploadImage } from '@/lib/cloudinary';

/** The profile picture: kept in the owner's synced values, changed by picking a file (uploaded, then its address saved). */
export function useAvatar() {
  const [avatarUrl, setAvatarUrl] = useFirebaseSync<string | null>('avatar_url', null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setAvatarUrl(await uploadImage(file));
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  };

  return { avatarUrl, uploading, failed, dismissFailure: () => setFailed(false), fileInputRef, openPicker, onFileChange };
}
