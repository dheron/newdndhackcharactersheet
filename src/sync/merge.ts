// Deciding what to do when syncing the characters on this device with the copies in Google Drive.
// Kept free of network code so it can be tested directly. The newer copy of a character wins.

export interface LocalEntry {
  id: string;
  /** When it was last saved here ("" for files saved before this was recorded: the oldest). */
  updatedAt: string;
}

export interface RemoteEntry {
  id: string;
  fileId: string;
  updatedAt: string;
}

export interface SyncPlan {
  /** Characters to upload (newer here, or not in Drive yet). */
  upload: string[];
  /** Drive files to download (newer in Drive, or new from another device). */
  download: RemoteEntry[];
  /** Characters to delete here: they were synced before and have since been deleted on another device. */
  deleteLocal: string[];
  /** Drive files to delete: deleted on this device since the last sync. */
  deleteRemote: RemoteEntry[];
}

/**
 * @param synced ids that were in Drive at the end of the last sync from this device
 * @param deletedHere ids deleted on this device since then
 */
export function planSync(local: LocalEntry[], remote: RemoteEntry[], synced: Set<string>, deletedHere: Set<string>): SyncPlan {
  const plan: SyncPlan = { upload: [], download: [], deleteLocal: [], deleteRemote: [] };
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localIds = new Set(local.map((l) => l.id));
  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r) {
      if (synced.has(l.id)) plan.deleteLocal.push(l.id);
      else plan.upload.push(l.id);
    } else if (l.updatedAt > r.updatedAt) plan.upload.push(l.id);
    else if (r.updatedAt > l.updatedAt) plan.download.push(r);
  }
  for (const r of remote) {
    if (localIds.has(r.id)) continue;
    if (deletedHere.has(r.id)) plan.deleteRemote.push(r);
    else plan.download.push(r);
  }
  return plan;
}
