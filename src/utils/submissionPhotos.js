export function activeSubmissionPhotos(photos) {
  return (photos || []).filter(photo => photo.deleted_at == null);
}

export async function removeSubmissionPhoto(client, photo) {
  const { data: path, error } = await client.rpc('cs_delete_live_photo', { p_photo_id: photo.id });
  if (error) {
    // An old tab or another device may already have deleted this photo. Confirm
    // that through the caller's RLS-protected read; never hide permission errors.
    if (error.message === 'Photo not found') {
      const check = await client.from('cs_submission_photos').select('id,deleted_at').eq('id', photo.id).maybeSingle();
      if (!check.error && check.data?.deleted_at) return { alreadyDeleted: true, cleanupWarning: false };
    }
    throw error;
  }
  // The report no longer contains the photo even if storage cleanup fails.
  // Do not show a deleted photo again or invite the user to delete its ID twice.
  let cleanupWarning = false;
  if (photo.public_url && path) {
    try {
      const result = await client.storage.from('cs-published-photos').remove([...new Set([path, photo.thumbnail_path].filter(Boolean))]);
      cleanupWarning = Boolean(result.error);
    } catch { cleanupWarning = true; }
  }
  return { alreadyDeleted: false, cleanupWarning };
}
