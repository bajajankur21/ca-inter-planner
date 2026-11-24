// Sync decisions as a pure function: no Firebase, no DOM, so every case is easy to test.

/** Per-device bookkeeping. syncedRev: the cloud revision this device last matched. dirty: local edits not yet in the cloud. */
export const BLANK_META = Object.freeze({ uid: '', syncedRev: '', dirty: false, editedAt: 0 });

/**
 * What to do when the cloud copy arrives or changes.
 * remote: null when the account has no cloud copy yet, else { rev, updatedAt }.
 * Returns 'push' (send this device's copy up), 'adopt' (take the cloud copy), 'ask' (both sides hold different data), or 'idle'.
 * Conflicts between two devices that both edited are settled by the newest edit: fine for one person, two devices.
 */
export function reconcile({ remote, meta, uid, localHasData, remoteHasData, sameContent }) {
  if (!remote) return 'push';

  const firstSyncHere = meta.uid !== uid || !meta.syncedRev;
  if (firstSyncHere) {
    if (!remoteHasData) return 'push';
    if (!localHasData || sameContent) return 'adopt';
    return 'ask';
  }

  if (remote.rev === meta.syncedRev) return meta.dirty ? 'push' : 'idle';
  if (!meta.dirty) return 'adopt';
  return remote.updatedAt > meta.editedAt ? 'adopt' : 'push';
}
