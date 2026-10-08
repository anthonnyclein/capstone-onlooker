/**
 * Automatic text-file backup.
 *
 * The coordinator picks a backup folder once; from then on every change to the
 * app data is written straight to that folder as CSV files (plus a manifest),
 * so the data always exists as plain text files on disk that any spreadsheet
 * can open. The folder handle is persisted in IndexedDB, so the link survives
 * page reloads; browsers then only ask to re-grant write permission when the
 * user comes back (handled by the "Resume" button, which needs a click).
 *
 * Uses the File System Access API (Chromium). Everywhere else the manual
 * "Download CSV Files" button in the Coordinator settings is the fallback.
 */
import { storage } from './storage';
import type { CsvTableFile } from './portableData';

/* ---------------------------- minimal FS types ---------------------------- */

interface WritableLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}
interface FileHandleLike {
  createWritable: () => Promise<WritableLike>;
}
interface DirectoryHandleLike {
  name: string;
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileHandleLike>;
}
interface PickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite';
    id?: string;
    startIn?: string;
  }) => Promise<DirectoryHandleLike>;
}

function pickerWindow(): PickerWindow {
  return window as unknown as PickerWindow;
}

export function isAutoSaveSupported(): boolean {
  return typeof window !== 'undefined' && typeof pickerWindow().showDirectoryPicker === 'function';
}

/* ------------------------------ persistence ------------------------------- */

const IDB_NAME = 'cpms_backup_db';
const IDB_STORE = 'meta';
const FOLDER_KEY = 'backup_folder';

function openMetaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistFolder(handle: DirectoryHandleLike | null): Promise<void> {
  try {
    const db = await openMetaDb();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    if (handle) store.put(handle, FOLDER_KEY);
    else store.delete(FOLDER_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Could not persist backup folder handle', err);
  }
}

async function readPersistedFolder(): Promise<DirectoryHandleLike | null> {
  try {
    const db = await openMetaDb();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const value = await new Promise<DirectoryHandleLike | null>((resolve, reject) => {
      const request = store.get(FOLDER_KEY);
      request.onsuccess = () => resolve((request.result as DirectoryHandleLike) || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

/* --------------------------------- state ---------------------------------- */

export interface AutoSaveState {
  supported: boolean;
  /** Name of the connected backup folder, if any. */
  folderName: string | null;
  /** True when a folder is connected but the browser must re-ask permission. */
  needsPermission: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  lastSavedFiles: number | null;
  lastError: string | null;
}

let state: AutoSaveState = {
  supported: isAutoSaveSupported(),
  folderName: null,
  needsPermission: false,
  saving: false,
  lastSavedAt: null,
  lastSavedFiles: null,
  lastError: null,
};

const listeners = new Set<() => void>();

export function getAutoSaveState(): AutoSaveState {
  return state;
}

export function subscribeAutoSave(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function setState(patch: Partial<AutoSaveState>): void {
  state = { ...state, ...patch };
  listeners.forEach((callback) => callback());
}

/* -------------------------------- writing --------------------------------- */

let folder: DirectoryHandleLike | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<void> = Promise.resolve();
let initialized = false;

function canWrite(): boolean {
  return folder !== null && !state.needsPermission;
}

async function performWrite(): Promise<void> {
  if (!canWrite() || !folder) return;
  setState({ saving: true, lastError: null });
  try {
    const files: CsvTableFile[] = storage.exportAllAsCsv();
    for (const file of files) {
      const fileHandle = await folder.getFileHandle(file.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file.text);
      await writable.close();
    }
    setState({
      saving: false,
      lastSavedAt: new Date().toISOString(),
      lastSavedFiles: files.length,
      lastError: null,
    });
  } catch (err) {
    setState({
      saving: false,
      lastError: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Queue a write (writes never overlap). */
function enqueueWrite(): Promise<void> {
  queue = queue.then(performWrite, performWrite);
  return queue;
}

/** Debounced write triggered by storage changes. */
export function scheduleAutoSave(delayMs = 700): void {
  if (!canWrite()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void enqueueWrite();
  }, delayMs);
}

/** Write every CSV file to the connected folder right now. */
export async function saveNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await enqueueWrite();
}

/* ------------------------------ folder link ------------------------------- */

async function activate(handle: DirectoryHandleLike, persist: boolean): Promise<void> {
  folder = handle;
  if (persist) await persistFolder(handle);
  setState({
    supported: true,
    folderName: handle.name,
    needsPermission: false,
    lastError: null,
  });
  await enqueueWrite();
}

/** Pick a folder and start saving CSV files into it automatically. */
export async function chooseBackupFolder(): Promise<boolean> {
  const picker = pickerWindow().showDirectoryPicker;
  if (!picker) return false;
  try {
    const handle = await picker({ mode: 'readwrite', id: 'cpms-backup' });
    await activate(handle, true);
    return true;
  } catch (err) {
    // A dismissed picker is not an error worth surfacing.
    if (err instanceof DOMException && err.name === 'AbortError') return false;
    setState({ lastError: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/** Re-grant write permission for the remembered folder (needs a user click). */
export async function resumeBackupFolder(): Promise<boolean> {
  if (!folder) return false;
  try {
    let permission: PermissionState = 'granted';
    if (folder.requestPermission) {
      permission = await folder.requestPermission({ mode: 'readwrite' });
    }
    if (permission !== 'granted') {
      setState({ needsPermission: true });
      return false;
    }
    setState({ needsPermission: false, lastError: null });
    await enqueueWrite();
    return true;
  } catch (err) {
    setState({ lastError: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/** Disconnect the folder (files already written are left untouched). */
export async function disableBackupFolder(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  folder = null;
  await persistFolder(null);
  setState({ folderName: null, needsPermission: false, lastError: null, saving: false });
}

/**
 * Restore a previously connected folder and start listening for changes.
 * Safe to call multiple times (React StrictMode) – it only initialises once.
 * Returns a cleanup function for the storage subscription.
 */
export function initAutoBackup(): () => void {
  if (!initialized) {
    initialized = true;
    void (async () => {
      const handle = await readPersistedFolder();
      if (!handle) return;
      folder = handle;
      let permission: PermissionState = 'granted';
      if (handle.queryPermission) {
        permission = await handle.queryPermission({ mode: 'readwrite' });
      }
      if (permission === 'granted') {
        setState({ supported: true, folderName: handle.name, needsPermission: false });
        await enqueueWrite();
      } else {
        setState({ supported: true, folderName: handle.name, needsPermission: true });
      }
    })();
  }

  const unsubscribe = storage.subscribe(() => scheduleAutoSave());
  return () => {
    unsubscribe();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
