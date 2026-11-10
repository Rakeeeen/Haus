const CLOUD_NAME = 'dnwi7kl3f';
/** An unsigned upload preset: it can only add images to this account's folder, so it is safe to ship in the page. */
const UPLOAD_PRESET = 'rakeeen_home';

/** Uploads an image to Cloudinary and returns its https address. Rejects with Cloudinary's own message if it refuses. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Upload failed');
  return body.secure_url as string;
}
