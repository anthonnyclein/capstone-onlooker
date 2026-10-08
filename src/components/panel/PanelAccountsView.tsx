import React, { useState } from 'react';
import { UserAccount } from '../../types';
import { storage } from '../../services/storage';
import { EditPanelAccountModal } from '../instructor/EditPanelAccountModal';
import { Edit, KeyRound } from 'lucide-react';
import { getDefaultPassword } from '../../utils/credentials';

export const PanelAccountsView: React.FC = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>(storage.getAccounts().filter(a => a.role === 'panel'));
  const [editingAccount, setEditingAccount] = useState<UserAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetNotice, setResetNotice] = useState<{ name: string; username: string; defaultPassword: string } | null>(null);

  const handleEdit = (account: UserAccount) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const handleSave = async (updated: UserAccount) => {
    try {
      const response = await fetch(`/api/accounts/${updated.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(`Failed to update account: ${err.error || response.statusText}`);
        return;
      }
      storage.updateAccount(updated);
      setAccounts(storage.getAccounts().filter(a => a.role === 'panel'));
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      alert('An unexpected error occurred while updating the account.');
    }
  };

  const handleResetPassword = async (account: UserAccount) => {
    const confirmed = window.confirm(
      `Reset password for ${account.academicTitle || ''} ${account.firstName} ${account.lastName} (@${account.username})?\n\nTheir password will be reset to their username and they will be prompted to change it on next login.`
    );
    if (!confirmed) return;

    const resetPayload = { passwordHash: null, mustChangePassword: true };

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetPayload),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(`Failed to reset password: ${err.error || response.statusText}`);
        return;
      }
      storage.updateAccount({ id: account.id, passwordHash: undefined, mustChangePassword: true });
      setAccounts(storage.getAccounts().filter(a => a.role === 'panel'));

      const defaultPassword = getDefaultPassword(account.username);
      setResetNotice({
        name: `${account.academicTitle || ''} ${account.firstName} ${account.lastName}`.trim(),
        username: account.username,
        defaultPassword,
      });
    } catch (e) {
      console.error(e);
      alert('An unexpected error occurred while resetting the password.');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800">Panel Accounts</h2>

      {/* Reset password success notice */}
      {resetNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <div className="font-bold mb-1 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-600" />
            Password Reset Successful
          </div>
          <p className="text-xs text-amber-800">
            <strong>{resetNotice.name}</strong>'s password has been reset.
          </p>
          <div className="mt-2 p-2 bg-white border border-amber-200 rounded-lg text-xs font-mono">
            <div>Username: <strong>@{resetNotice.username}</strong></div>
            <div>Temporary Password: <strong>{resetNotice.defaultPassword}</strong></div>
          </div>
          <p className="text-[11px] text-amber-700 mt-1.5">
            The panel member will be prompted to change their password on next login.
          </p>
          <button
            onClick={() => setResetNotice(null)}
            className="mt-2 text-xs text-amber-700 hover:text-amber-900 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Username</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Name</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Title</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Avatar</th>
            <th className="px-4 py-2 text-center text-sm font-medium text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(acc => (
            <tr key={acc.id} className="border-t border-slate-200">
              <td className="px-4 py-2 text-sm text-slate-700">@{acc.username}</td>
              <td className="px-4 py-2 text-sm text-slate-700">{acc.firstName} {acc.lastName}</td>
              <td className="px-4 py-2 text-sm text-slate-700">{acc.academicTitle ?? ''}</td>
              <td className="px-4 py-2">
                {acc.avatarUrl ? (
                  <img src={acc.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
                ) : <span className="text-slate-400">N/A</span>}
              </td>
              <td className="px-4 py-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleEdit(acc)}
                    className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleResetPassword(acc)}
                    title="Reset panel member password to default"
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors"
                  >
                    <KeyRound className="w-3 h-3 text-amber-600" />
                    Reset
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && editingAccount && (
        <EditPanelAccountModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          existingAccounts={storage.getAccounts().filter(a => a.id !== editingAccount.id)}
          account={editingAccount}
        />
      )}
    </div>
  );
};
