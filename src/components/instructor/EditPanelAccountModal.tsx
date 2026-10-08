import { normalizeUsername } from '../../utils/credentials';
import React, { useState, useEffect } from 'react';
import { UserAccount } from '../../types';
import {
  ShieldCheck,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  AVATAR_COLOR_PRESETS,
  getInitials,
  generateInitialsAvatarSvg,
  AvatarColorPreset,
} from '../../utils/avatar';

interface EditPanelAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: UserAccount) => void;
  existingAccounts: UserAccount[];
  account: UserAccount;
}

const TITLE_OPTIONS = [
  'Dr.',
  'Prof.',
  'Engr.',
  'Assoc. Prof.',
  'Asst. Prof.',
  'Dean',
  'Atty.',
  'Arch.',
  'Mr.',
  'Ms.',
];

export const EditPanelAccountModal: React.FC<EditPanelAccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingAccounts,
  account,
}) => {
  const [academicTitle, setAcademicTitle] = useState(account.academicTitle || 'Dr.');
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [username, setUsername] = useState(account.username);
  const [isUsernameCustom, setIsUsernameCustom] = useState(true);
  const [academicRank, setAcademicRank] = useState(account.academicRank || '');
  const [selectedPreset, setSelectedPreset] = useState<AvatarColorPreset>(AVATAR_COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  const initials = getInitials(firstName, lastName);

  useEffect(() => {
    if (!isUsernameCustom && (firstName || lastName)) {
      setUsername(normalizeUsername(firstName, lastName));
    }
  }, [firstName, lastName, isUsernameCustom]);

  // Reset form when account changes
  useEffect(() => {
    setAcademicTitle(account.academicTitle || 'Dr.');
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setUsername(account.username);
    setAcademicRank(account.academicRank || '');
    setError(null);
  }, [account]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedUser = (username.trim() || normalizeUsername(trimmedFirst, trimmedLast)).toLowerCase();
    if (!trimmedFirst) { setError("Please provide the panel member's first name."); return; }
    if (!trimmedLast) { setError("Please provide the panel member's last name."); return; }
    if (!trimmedUser) { setError('Please specify an institutional username.'); return; }
    const duplicate = existingAccounts.find(a => a.username.toLowerCase() === trimmedUser);
    if (duplicate) {
      setError(`Username "@${trimmedUser}" is already taken by ${duplicate.firstName} ${duplicate.lastName}.`);
      return;
    }
    const avatarSvg = generateInitialsAvatarSvg(
      trimmedFirst,
      trimmedLast,
      selectedPreset.hexColor,
      selectedPreset.textColor
    );
    const updatedAccount: UserAccount = {
      ...account,
      username: trimmedUser,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      academicTitle,
      academicRank: academicRank.trim() || account.academicRank,
      avatarUrl: avatarSvg,
    };
    onSave(updatedAccount);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/30 border border-orange-500/40 text-orange-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Edit Panel Member Account</h3>
              <p className="text-xs text-slate-400">Modify details for a faculty evaluator or industry panelist</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Academic Title & Names */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Title
              </label>
              <select
                value={academicTitle}
                onChange={(e) => setAcademicTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500 font-medium"
              >
                {TITLE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pedro"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Penduko"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500 font-medium"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Username <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">@</span>
              <input
                type="text"
                required
                placeholder="pedro.penduko"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setIsUsernameCustom(true);
                }}
                className="w-full text-xs pl-7 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500 font-mono text-slate-800"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Used for signing in and defense reports</p>
          </div>

          {/* Academic Rank / Department */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Academic Rank & Specialization
            </label>
            <input
              type="text"
              placeholder="e.g. Associate Professor, Software Engineering & Systems Design"
              value={academicRank}
              onChange={(e) => setAcademicRank(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:border-orange-500"
            />
          </div>

          {/* Avatar Choice */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Select Avatar
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                Initials:{' '}
                <span className="font-bold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded border border-orange-200">
                  {initials}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto p-1">
              {AVATAR_COLOR_PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`relative rounded-full p-0.5 transition-all ${
                      isSelected
                        ? 'ring-2 ring-orange-500 ring-offset-2 scale-105'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    title={`${preset.name} (${initials})`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ${preset.bgColor}`}
                    >
                      {initials}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Avatar automatically displays first letters of first name and last name.
            </p>
          </div>

          {/* Quick Preview Card */}
          <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs ${selectedPreset.bgColor} border border-orange-300 shrink-0`}
              >
                {initials}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {academicTitle} {firstName || 'First'} {lastName || 'Last'}
                </div>
                <div className="text-[11px] text-orange-700">
                  @{username || 'username'} &bull; {academicRank || 'Panelist'}
                </div>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold bg-orange-600 text-white px-2 py-0.5 rounded">
              Panel Role
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
