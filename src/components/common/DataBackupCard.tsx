import { flushFileStore } from '../../services/fileStore';
import React, { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  FolderOpen,
  Download,
  Upload,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { storage } from '../../services/storage';
import {
  getAutoSaveState,
  subscribeAutoSave,
  chooseBackupFolder,
  resumeBackupFolder,
  disableBackupFolder,
  saveNow,
} from '../../services/autoBackup';
import type { ImportParseResult } from '../../services/portableData';
import { ConfirmDialog } from './ConfirmDialog';

interface Notice {
  tone: 'ok' | 'error';
  text: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function triggerDownload(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Coordinator-only card that keeps the whole dataset as spreadsheet-ready CSV
 * text files: automatic saving into a chosen folder, manual download, and
 * importing a folder of CSV files on another PC.
 */
export const DataBackupCard: React.FC = () => {
  const [auto, setAuto] = useState(getAutoSaveState());
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<{ result: ImportParseResult; fileCount: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeAutoSave(() => setAuto(getAutoSaveState())), []);

  const handleChooseFolder = async () => {
    setBusy(true);
    const ok = await chooseBackupFolder();
    setBusy(false);
    if (ok) {
      setNotice({
        tone: 'ok',
        text: 'Backup folder connected. Every change is now saved automatically as CSV files in that folder.',
      });
    }
  };

  const handleResume = async () => {
    setBusy(true);
    const ok = await resumeBackupFolder();
    setBusy(false);
    setNotice(
      ok
        ? { tone: 'ok', text: 'Extra CSV backup resumed for the connected folder.' }
        : { tone: 'error', text: 'Permission was not granted — automatic saving stays off until you allow access.' }
    );
  };

  const handleDisable = async () => {
    await disableBackupFolder();
    setNotice({ tone: 'ok', text: 'Extra folder backup turned off. Files already written remain on disk.' });
  };

  const handleSaveNow = async () => {
    setBusy(true);
    await saveNow();
    setBusy(false);
    setNotice({ tone: 'ok', text: `Saved ${auto.lastSavedFiles ?? 'all'} CSV files just now.` });
  };

  const handleDownload = () => {
    const files = storage.exportAllAsCsv();
    const rows = files.reduce((sum, file) => sum + file.rows, 0);
    files.forEach((file, index) => {
      setTimeout(() => triggerDownload(file.name, file.text), index * 150);
    });
    setNotice({
      tone: 'ok',
      text: `Downloading ${files.length} CSV files (${rows} rows). If your browser asks to allow multiple downloads, choose Allow. Copy the whole folder to another PC and use "Import CSV Files" there.`,
    });
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length === 0) return;
    try {
      const files = await Promise.all(
        selected.map(async (file) => ({ name: file.name, text: await file.text() }))
      );
      const result = storage.parseImportFiles(files);
      if (result.imported.length === 0) {
        setNotice({
          tone: 'error',
          text: `No known data tables found in the ${selected.length} selected file(s). Select the CSV files created by this app (files starting with "cpms_").`,
        });
        return;
      }
      setNotice(null);
      setPending({ result, fileCount: selected.length });
    } catch (err) {
      setNotice({ tone: 'error', text: `Could not read the selected files: ${err instanceof Error ? err.message : String(err)}` });
    }
  };

  const handleConfirmImport = async () => {
    if (!pending) return;
    try {
    const applied = storage.applyImportResult(pending.result);
    await flushFileStore();
    const rows = pending.result.imported.reduce((sum, table) => sum + table.rows, 0);
    const skippedNote = pending.result.skipped.length
      ? ` Skipped file(s): ${pending.result.skipped.join(', ')}.`
      : '';
    setNotice({
      tone: 'ok',
      text: `Imported ${rows} rows into ${applied.length} table(s) from ${pending.fileCount} file(s).${skippedNote} The app now shows the imported data.`,
    });
    setPending(null);
    } catch (error) { setNotice({ tone: 'error', text: String(error) }); }
  };

  const pendingRows = pending
    ? pending.result.imported.reduce((sum, table) => sum + table.rows, 0)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        Data Backup &amp; Transfer — Spreadsheet Text Files (CSV)
      </h3>

      <p className="text-xs text-slate-600 leading-relaxed">
        All offices, groups, students, deliverables, submissions, grades, accounts, and defense records are
        saved automatically in <strong>data/capstone.csv</strong>, a plain text file, with PDF bytes encoded in text. You can also download additional CSV tables that open directly in Excel or Google Sheets. Save them
        as an extra backup if desired. The main data file is saved automatically by the local project server.
      </p>

      {/* Automatic saving status */}
      {!auto.supported && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
          <strong>Automatic folder saving</strong> needs a Chromium-based browser (Chrome or Edge). This
          browser does not support it — use <strong>Download CSV Files</strong> below instead, then import the
          folder on the target PC.
        </div>
      )}

      {auto.supported && auto.folderName && !auto.needsPermission && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Automatic saving is <strong>ON</strong> — folder{' '}
            <span className="font-mono font-semibold">“{auto.folderName}”</span>. Last saved{' '}
            {formatTime(auto.lastSavedAt)}
            {auto.lastSavedFiles !== null ? ` • ${auto.lastSavedFiles} CSV files` : ''}
            {auto.saving ? ' • saving…' : ''}
            {auto.lastError ? <span className="text-rose-700"> • error: {auto.lastError}</span> : null}
          </div>
        </div>
      )}

      {auto.supported && auto.folderName && auto.needsPermission && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            Backup folder <span className="font-mono font-semibold">“{auto.folderName}”</span> is remembered,
            but the browser needs you to re-allow writing to it for this session.
            <button
              onClick={handleResume}
              disabled={busy}
              className="ml-2 px-3 py-1.5 font-semibold bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Resume Extra Backup
            </button>
          </div>
        </div>
      )}

      {auto.supported && !auto.folderName && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
          An optional extra backup folder is not connected. Your main CSV file is already saved automatically. Choose a folder to keep additional spreadsheet tables.
        </div>
      )}

      <a href="/api/backup" download="capstone.csv" className="inline-block px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg">Download Complete CSV Backup</a>
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {auto.supported && !auto.folderName && (
          <button
            onClick={handleChooseFolder}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Choose Backup Folder
          </button>
        )}

        {auto.folderName && !auto.needsPermission && (
          <button
            onClick={handleSaveNow}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-emerald-600" />
            Save Now
          </button>
        )}

        {auto.folderName && !auto.needsPermission && (
          <button
            onClick={handleDisable}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors"
          >
            Disconnect Extra Backup
          </button>
        )}

        <button
          onClick={handleDownload}
          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-indigo-600" />
          Download CSV Files
        </button>

        <button
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Import CSV Files
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>

      {/* Feedback */}
      {notice && (
        <div
          className={`p-3 rounded-lg text-xs leading-relaxed border flex items-start gap-2 ${
            notice.tone === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {notice.tone === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
        <strong>How to move to another PC:</strong> (1) connect a backup folder or press{' '}
        <em>Download CSV Files</em>, (2) copy the folder to the new machine, (3) install and open the app there,
        sign in as the Coordinator, (4) press <em>Import CSV Files</em> and select all the CSV files (Ctrl+A).
        Only the tables you import are replaced; everything else stays as it is.
      </p>

      {/* Import confirmation */}
      <ConfirmDialog
        isOpen={!!pending}
        onClose={() => setPending(null)}
        onConfirm={handleConfirmImport}
        title="Import CSV Data Files"
        message={`Import ${pendingRows} rows across ${pending?.result.imported.length ?? 0} table(s) from ${
          pending?.fileCount ?? 0
        } file(s)? This replaces the matching data currently in the app. Tables: ${
          pending?.result.imported.map((table) => table.label).join(', ') ?? ''
        }.${
          pending?.result.skipped.length
            ? ` Ignored: ${pending.result.skipped.join(', ')}.`
            : ''
        }`}
        confirmLabel="Import Now"
      />
    </div>
  );
};
