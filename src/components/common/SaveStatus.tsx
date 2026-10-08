import { useEffect, useState } from 'react';
import { flushFileStore, getSaveStatus, subscribeSaveStatus } from '../../services/fileStore';
export function SaveStatus() {
  const [status, setStatus] = useState(getSaveStatus);
  useEffect(() => subscribeSaveStatus(() => setStatus(getSaveStatus())), []);
  return <div role="status" className={`px-4 py-1 text-xs ${status.startsWith('Not saved') ? 'bg-rose-100 text-rose-900' : 'bg-slate-100 text-slate-600'}`}>
    {status}{status.startsWith('Not saved') && <button className="ml-3 underline" onClick={() => void flushFileStore().catch(() => {})}>Retry save</button>}
  </div>;
}
