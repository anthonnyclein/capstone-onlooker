import { authService } from './authService';

// PostgreSQL database is the source of truth; this map is the current client cache.
let values: Record<string, string> = {};
let revision = 0;
let dirty = false;
let saving: Promise<void> | null = null;
let syncing = false;
let error = '';
const listeners = new Set<() => void>();
const dataChangeListeners = new Set<() => void>();

const announce = () => listeners.forEach(listener => listener());
const announceDataChange = () => dataChangeListeners.forEach(listener => listener());

export async function initializeFileStore() {
  const response = await fetch('/api/state', {
    cache: 'no-store',
    headers: {
      ...authService.getAuthHeaders(),
    },
  });
  if (!response.ok) throw new Error('Cannot load storage. Make sure the full-stack server is running.');
  const state = await response.json();
  values = state.values;
  revision = state.revision;

  startAutoSync();
}

/**
 * Periodically polls the server for state updates committed by other concurrent users.
 * When a higher revision is detected and no unsaved local changes exist, updates cache and notifies listeners.
 */
let syncInterval: any = null;
function startAutoSync() {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    // Skip remote pull if there are unsaved local modifications in flight
    if (dirty || saving || syncing) return;
    try {
      syncing = true;
      const revRes = await fetch('/api/state/revision', {
        cache: 'no-store',
        headers: { ...authService.getAuthHeaders() },
      });
      if (!revRes.ok) return;
      const { revision: serverRev } = await revRes.json();
      
      if (typeof serverRev === 'number' && serverRev > revision && !dirty && !saving) {
        const fullRes = await fetch('/api/state', {
          cache: 'no-store',
          headers: { ...authService.getAuthHeaders() },
        });
        if (fullRes.ok && !dirty && !saving) {
          const freshState = await fullRes.json();
          values = freshState.values;
          revision = freshState.revision;
          error = '';
          announce();
          announceDataChange();
        }
      }
    } catch {
      // Quietly ignore transient network glitches during background polling
    } finally {
      syncing = false;
    }
  }, 2500);
}

export const fileStore = {
  getItem(key: string): string | null { return values[key] ?? null; },
  setItem(key: string, value: string) { values[key] = value; dirty = true; scheduleSave(); },
  removeItem(key: string) { delete values[key]; dirty = true; scheduleSave(); },
};

function scheduleSave() {
  announce();
  queueMicrotask(() => { void flushFileStore().catch(() => {}); });
}

export function subscribeSaveStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function subscribeDataChanges(listener: () => void) {
  dataChangeListeners.add(listener);
  return () => { dataChangeListeners.delete(listener); };
}

export function getSaveStatus() { 
  if (error) return error;
  if (dirty || saving) return 'Saving to PostgreSQL database…';
  if (syncing) return 'Synchronizing database…';
  return 'Saved to PostgreSQL database'; 
}

export async function flushFileStore(): Promise<void> {
  if (saving) { await saving; if (dirty) return flushFileStore(); return; }
  if (!dirty) return;
  saving = (async () => {
    try {
      while (dirty) {
        dirty = false;
        const response = await fetch('/api/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ values, revision }),
        });
        
        // Handle revision conflict from concurrent user commit
        if (response.status === 409) {
          // Fetch latest state from server to align revision
          const fresh = await fetch('/api/state', {
            cache: 'no-store',
            headers: { ...authService.getAuthHeaders() },
          });
          if (fresh.ok) {
            const freshState = await fresh.json();
            revision = freshState.revision;
            // Retry save with refreshed base revision
            dirty = true;
            continue;
          }
        }

        if (!response.ok) throw new Error((await response.json()).error || 'Database save failed.');
        revision = (await response.json()).revision;
        error = '';
      }
    } catch (cause) {
      dirty = true;
      error = `Not saved: ${cause instanceof Error ? cause.message : 'Database service unavailable'}`;
      throw cause;
    } finally { 
      saving = null; 
      announce(); 
    }
  })();
  announce();
  return saving;
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
  });
}
