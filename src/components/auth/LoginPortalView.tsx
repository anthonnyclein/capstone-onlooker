import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserAccount } from '../../types';
import { storage } from '../../services/storage';
import { flushFileStore } from '../../services/fileStore';
import { getDefaultPassword, normalizeUsername } from '../../utils/credentials';
import { hashPassword, verifyPassword } from '../../utils/password';
import { authService } from '../../services/authService';

export function LoginPortalView({ accounts, onSelectUser }: { accounts: UserAccount[]; onSelectUser: (user: UserAccount) => void }) {
  const setup = accounts.length === 0;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const coordinatorUsername = normalizeUsername(firstName, lastName);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      let user: UserAccount;
      if (setup) {
        const finalUsername = normalizeUsername(firstName, lastName);
        if (!firstName.trim() || !lastName.trim() || !finalUsername) {
          throw new Error('Please provide your first name and last name to generate your coordinator account.');
        }
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        if (password !== confirm) throw new Error('Passwords do not match.');

        try {
          const authRes = await authService.setupCoordinator(firstName.trim(), lastName.trim(), password);
          user = authRes.user;
          storage.addAccount(user);
        } catch (apiErr: any) {
          // Fallback if direct setup endpoint had an error or testing offline
          user = {
            id: crypto.randomUUID(),
            username: finalUsername,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            role: 'instructor',
            passwordHash: await hashPassword(password),
            mustChangePassword: false,
          };
          storage.addAccount(user);
        }
      } else {
        const query = username.trim().toLowerCase();
        try {
          const authRes = await authService.login(query, password);
          user = authRes.user;
          storage.addAccount(user);
        } catch {
          // Fallback to client-side verification
          const account = accounts.find(
            a => a.username.toLowerCase() === query || normalizeUsername(a.firstName, a.lastName) === query
          );
          const expectedDefaultPass = account ? getDefaultPassword(account.username) : '';
          const valid =
            account &&
            (account.passwordHash
              ? await verifyPassword(password, account.passwordHash)
              : account.mustChangePassword &&
                (password === expectedDefaultPass ||
                  password === getDefaultPassword(account.firstName) ||
                  (account.role === 'instructor' && password === getDefaultPassword(normalizeUsername(account.firstName, account.lastName)))));
          if (!account || !valid) throw new Error('Incorrect username or password.');
          user = account;
          const canonical = normalizeUsername(user.firstName, user.lastName);
          let accountChanged = false;
          if (canonical && user.username !== canonical) {
            user = { ...user, username: canonical };
            accountChanged = true;
          }
          if (!user.passwordHash) {
            user = { ...user, passwordHash: await hashPassword(password) };
            accountChanged = true;
          }
          if (accountChanged) {
            storage.updateAccount(user);
          }
        }
      }
      await flushFileStore();
      onSelectUser(user);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 p-3 text-slate-900 focus:outline-hidden focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600';

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <section className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl border border-slate-100">
        <p className="text-indigo-600 font-bold text-xs uppercase tracking-wider mb-6">CAPSTONE PROJECT PROPOSAL ONLOOKER</p>
        {setup && (
          <>
            <h1 className="text-2xl font-bold text-slate-900">Set up coordinator account</h1>
            <p className="text-sm text-slate-500 mt-2 mb-6">
              Create the initial coordinator account. Coordinator usernames strictly follow the firstname.lastname format.
            </p>
          </>
        )}
        <form onSubmit={submit} className="space-y-4" autoComplete="off">
          {setup ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-slate-700">
                  First name
                  <input
                    required
                    className={inputClass}
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. Maria"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Last name
                  <input
                    required
                    className={inputClass}
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. Santos"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Assigned Coordinator Username
                </label>
                <div className="mt-1 flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-800">
                  <span className="font-mono text-sm font-semibold text-indigo-700">
                    @{coordinatorUsername || 'firstname.lastname'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Coordinator username strictly conforms to <span className="font-mono font-medium text-slate-700">firstname.lastname</span>.
                </p>
              </div>
            </>
          ) : (
            <label className="block text-sm font-medium text-slate-700">
              Username
              <input
                required
                className={inputClass}
                autoComplete="off"
                name="cpms_user"
                id="cpms_username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                spellCheck={false}
                autoCapitalize="none"
                data-lpignore="true"
                data-1p-ignore="true"
                readOnly
                onFocus={e => e.target.removeAttribute('readonly')}
              />
            </label>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="relative">
              <input
                required
                type={showPassword ? 'text' : 'password'}
                className={`${inputClass} pr-10`}
                autoComplete="new-password"
                name="cpms_pass"
                id="cpms_password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                data-lpignore="true"
                data-1p-ignore="true"
                readOnly
                onFocus={e => e.target.removeAttribute('readonly')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {setup && (
            <label className="block text-sm font-medium text-slate-700">
              Confirm password
              <div className="relative">
                <input
                  required
                  type={showConfirm ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-hidden"
                  title={showConfirm ? 'Hide password' : 'Show password'}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>
          )}

          {error && <p role="alert" className="text-sm text-rose-700 font-medium">{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white p-3 font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            {busy ? 'Please wait…' : setup ? 'Create coordinator account' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
