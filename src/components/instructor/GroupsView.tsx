import { storage } from '../../services/storage';
import React, { useState, useMemo } from 'react';
import { Group, Office, StudentMember, StudentRole } from '../../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Building2,
  UserPlus,
  AlertCircle,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { normalizeUsername, getDefaultPassword, checkUsernameConflict } from '../../utils/credentials';

interface GroupsViewProps {
  groups: Group[];
  offices: Office[];
  onSaveGroups: (groups: Group[]) => void;
  selectedGroupIdFromParent?: string;
}

const AVAILABLE_ROLES: StudentRole[] = [
  'Project Manager',
  'Systems Analyst',
  'Programmer',
];

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  offices,
  onSaveGroups,
  selectedGroupIdFromParent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOfficeFilter, setSelectedOfficeFilter] = useState('all');

  // Selected Group Details Modal or View
  const [activeGroupModal, setActiveGroupModal] = useState<Group | null>(null);

  // Group Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedSubOfficeId, setSelectedSubOfficeId] = useState('');
  const [clientNamesInput, setClientNamesInput] = useState('');
  
  // Dynamic members form
  const [members, setMembers] = useState<
    {
      id?: string;
      firstName: string;
      lastName: string;
      roles: StudentRole[];
    }[]
  >([]);

  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Generated credentials modal for distribution
  const [credentialsModalData, setCredentialsModalData] = useState<{
    groupTitle: string;
    credentials: {
      name: string;
      username: string;
      defaultPassword: string;
      roles: string;
    }[];
  } | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Confirm delete group
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<Group | null>(null);

  // Filtered sub-offices based on selected office in form
  const currentOfficeSubOffices = useMemo(() => {
    const office = offices.find((o) => o.id === selectedOfficeId);
    return office ? office.subOffices : [];
  }, [offices, selectedOfficeId]);

  // All currently existing usernames in system (for uniqueness check)
  const existingUsernames = useMemo(() => {
    const list: string[] = storage.getAccounts().filter(account => account.role !== 'student').map(account => account.username);
    for (const g of groups) {
      if (editingGroupId && g.id === editingGroupId) continue; // skip current group being edited
      for (const m of g.members) {
        list.push(m.username);
      }
    }
    return list;
  }, [groups, editingGroupId]);

  // Open Form for Creating New Group
  const handleOpenCreateModal = () => {
    setEditingGroupId(null);
    setTitle('');
    const defaultOffice = offices[0];
    setSelectedOfficeId(defaultOffice?.id || '');
    setSelectedSubOfficeId(defaultOffice?.subOffices[0]?.id || '');
    setClientNamesInput('');
    setMembers([
      { firstName: '', lastName: '', roles: ['Project Manager'] },
      { firstName: '', lastName: '', roles: ['Systems Analyst'] },
      { firstName: '', lastName: '', roles: ['Programmer'] },
    ]);
    setFormErrors([]);
    setIsFormModalOpen(true);
  };

  // Open Form for Editing Existing Group
  const handleOpenEditModal = (group: Group) => {
    setEditingGroupId(group.id);
    setTitle(group.title);
    setSelectedOfficeId(group.officeId);
    setSelectedSubOfficeId(group.subOfficeId);
    setClientNamesInput(group.clientNames.join(', '));
    setMembers(
      group.members.map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        roles: [...m.roles],
      }))
    );
    setFormErrors([]);
    setIsFormModalOpen(true);
  };

  // Member field manipulations
  const handleAddMember = () => {
    setMembers((prev) => [
      ...prev,
      { firstName: '', lastName: '', roles: ['Programmer'] },
    ]);
  };

  const handleRemoveMember = (index: number) => {
    if (members.length <= 1) {
      setFormErrors(['A capstone group must have at least one member.']);
      return;
    }
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMemberChange = (
    index: number,
    field: 'firstName' | 'lastName',
    value: string
  ) => {
    setMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleToggleMemberRole = (index: number, role: StudentRole) => {
    setMembers((prev) =>
      prev.map((m, i) => {
        if (i !== index) return m;
        const exists = m.roles.includes(role);
        if (exists) {
          if (m.roles.length === 1) return m; // must have at least 1 role
          return { ...m, roles: m.roles.filter((r) => r !== role) };
        } else {
          return { ...m, roles: [...m.roles, role] };
        }
      })
    );
  };

  // Submit Group Creation / Edit
  const handleSubmitGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!title.trim()) {
      errors.push('Proposal Title is required.');
    }
    if (!selectedOfficeId) {
      errors.push('Office selection is required.');
    }
    if (!selectedSubOfficeId) {
      errors.push('Sub-office selection is required.');
    }
    if (!clientNamesInput.trim()) {
      errors.push('Main Client Name(s) are required.');
    }

    if (members.length === 0) {
      errors.push('At least one group member is required.');
    }

    // Validate members
    let hasProjectManager = false;
    const formUsernames: string[] = [];

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.firstName.trim() || !m.lastName.trim()) {
        errors.push(`Member #${i + 1} must have both First Name and Last Name.`);
      }
      if (m.roles.includes('Project Manager')) {
        hasProjectManager = true;
      }

      // Check username conflict
      const normalized = normalizeUsername(m.firstName, m.lastName);
      if (normalized && normalized !== '.') {
        // Check duplicate within the same form
        if (formUsernames.includes(normalized)) {
          errors.push(
            `Duplicate username in this group: "${normalized}". Member names must be unique.`
          );
        }
        formUsernames.push(normalized);

        // Check duplicate across existing accounts
        const conflict = checkUsernameConflict(normalized, existingUsernames);
        if (conflict) {
          errors.push(conflict);
        }
      }
    }

    if (!hasProjectManager) {
      errors.push('Requirement: Each group must have at least one Project Manager.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    // Parse clients
    const clients = clientNamesInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    // Build finalized student members with normalized credentials
    const finalMembers: StudentMember[] = members.map((m) => {
      const username = normalizeUsername(m.firstName, m.lastName);
      return {
        id: m.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        firstName: m.firstName.trim(),
        lastName: m.lastName.trim(),
        username,
        roles: m.roles,

        mustChangePassword: true, // will prompt on first login
      };
    });

    let updatedGroups: Group[];
    let savedGroup: Group;

    if (editingGroupId) {
      savedGroup = {
        ...groups.find(group => group.id === editingGroupId),
        id: editingGroupId,
        title: title.trim(),
        officeId: selectedOfficeId,
        subOfficeId: selectedSubOfficeId,
        clientNames: clients,
        members: finalMembers,
        createdAt:
          groups.find((g) => g.id === editingGroupId)?.createdAt ||
          new Date().toISOString(),
      };
      updatedGroups = groups.map((g) => (g.id === editingGroupId ? savedGroup : g));
    } else {
      savedGroup = {
        id: `grp-${Date.now()}`,
        title: title.trim(),
        officeId: selectedOfficeId,
        subOfficeId: selectedSubOfficeId,
        clientNames: clients,
        members: finalMembers,
        createdAt: new Date().toISOString(),
      };
      updatedGroups = [...groups, savedGroup];
    }

    onSaveGroups(updatedGroups);
    setIsFormModalOpen(false);

    // Show Generated Credentials Dialog for Distribution!
    setCredentialsModalData({
      groupTitle: savedGroup.title,
      credentials: savedGroup.members.filter(member => !storage.getAccounts().find(account => account.id === member.id)?.passwordHash).map((m) => ({
        name: `${m.firstName} ${m.lastName}`,
        username: m.username,
        defaultPassword: getDefaultPassword(m.username),
        roles: m.roles.join(', '),
      })),
    });
  };

  // Reset Student Password to Default
  const handleResetPassword = (group: Group, member: StudentMember) => {
    const defaultPassword = getDefaultPassword(member.username);
    const updatedGroups = groups.map((g) => {
      if (g.id !== group.id) return g;
      return {
        ...g,
        members: g.members.map((m) =>
          m.id === member.id
            ? { ...m, passwordHash: undefined, mustChangePassword: true }
            : m
        ),
      };
    });

    storage.updateAccount({ id: member.id, passwordHash: undefined, mustChangePassword: true });
    onSaveGroups(updatedGroups);

    // Open single credential distribution notice
    setCredentialsModalData({
      groupTitle: group.title,
      credentials: [
        {
          name: `${member.firstName} ${member.lastName}`,
          username: member.username,
          defaultPassword,
          roles: member.roles.join(', '),
        },
      ],
    });
  };

  // Delete Group
  const handleExecuteDeleteGroup = () => {
    if (!confirmDeleteGroup) return;
    if (storage.getSubmissions().some(submission => submission.groupId === confirmDeleteGroup.id) || storage.getDefenseAttempts().some(attempt => attempt.groupId === confirmDeleteGroup.id)) {
      alert('This group has submissions or defense records and cannot be deleted.');
      setConfirmDeleteGroup(null);
      return;
    }
    const updated = groups.filter((g) => g.id !== confirmDeleteGroup.id);
    onSaveGroups(updated);
    setConfirmDeleteGroup(null);
  };

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchSearch =
        g.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.clientNames.some((c) => c.toLowerCase().includes(searchTerm.toLowerCase())) ||
        g.members.some((m) =>
          `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
        );

      const matchOffice =
        selectedOfficeFilter === 'all' || g.officeId === selectedOfficeFilter;

      return matchSearch && matchOffice;
    });
  }, [groups, searchTerm, selectedOfficeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Groups & Student Roster Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create capstone groups, configure client beneficiaries, assign student roles, and generate login credentials.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create Capstone Group
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by proposal title, client, or student name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs text-slate-500">Filter Office:</span>
          <select
            value={selectedOfficeFilter}
            onChange={(e) => setSelectedOfficeFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg py-1.5 px-2.5 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Offices</option>
            {offices.map((off) => (
              <option key={off.id} value={off.id}>
                {off.code} - {off.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredGroups.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-white rounded-xl border border-slate-200">
            <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No capstone groups found.</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const office = offices.find((o) => o.id === group.officeId);
            const subOffice = office?.subOffices.find((s) => s.id === group.subOfficeId);

            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {office?.code || 'Office'} &bull; {subOffice?.code || 'Sub-office'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(group)}
                        title="Edit Group"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteGroup(group)}
                        title="Delete Group"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {group.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1.5">
                    <strong>Clients:</strong> {group.clientNames.join(', ')}
                  </p>

                  {/* Members & Credentials Table */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      <span>Group Members ({group.members.length})</span>
                      <span>Credentials & Roles</span>
                    </div>

                    <div className="space-y-2">
                      {group.members.map((m) => {
                        const isPM = m.roles.includes('Project Manager');
                        return (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {m.firstName} {m.lastName}
                                {isPM && (
                                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                                    PM
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <span>@{m.username}</span>
                                <span>&bull;</span>
                                <span className="text-slate-600 font-medium">
                                  {m.roles.join(', ')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleResetPassword(group, m)}
                                title="Reset student password to default first name"
                                className="text-[11px] px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium flex items-center gap-1 transition-colors"
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                Reset
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Distribution action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => {
                      setCredentialsModalData({
                        groupTitle: group.title,
                        credentials: group.members.map((m) => ({
                          name: `${m.firstName} ${m.lastName}`,
                          username: m.username,
                          defaultPassword: getDefaultPassword(m.username),
                          roles: m.roles.join(', '),
                        })),
                      });
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    View Credentials Roster
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Group Create/Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingGroupId ? 'Edit Capstone Group' : 'Create Capstone Group'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitGroup} className="space-y-4">
          {formErrors.length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Please resolve the following errors:
              </div>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Capstone Project Proposal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AgriFlow: Smart Irrigation & IoT Crop Analytics"
              required
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Office Assignment *
              </label>
              <select
                value={selectedOfficeId}
                onChange={(e) => {
                  setSelectedOfficeId(e.target.value);
                  const off = offices.find((o) => o.id === e.target.value);
                  setSelectedSubOfficeId(off?.subOffices[0]?.id || '');
                }}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
              >
                {offices.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.code} - {off.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sub-office Assignment * (Filtered by Office)
              </label>
              <select
                value={selectedSubOfficeId}
                onChange={(e) => setSelectedSubOfficeId(e.target.value)}
                className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
              >
                {currentOfficeSubOffices.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Main Client / Beneficiary Name(s) * (Comma-separated)
            </label>
            <input
              type="text"
              value={clientNamesInput}
              onChange={(e) => setClientNamesInput(e.target.value)}
              placeholder="Client organization, contact person"
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Repeatable Student Member Fields */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Student Members & Roles *
                </span>
                <span className="text-[11px] text-slate-500">
                  Multiple roles allowed per member. Must include at least 1 Project Manager.
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddMember}
                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 flex items-center gap-1 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Member
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {members.map((m, idx) => {
                const autoUsername =
                  m.firstName && m.lastName ? normalizeUsername(m.firstName, m.lastName) : '';

                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Member #{idx + 1}
                      </span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(idx)}
                          className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={m.firstName}
                          onChange={(e) => handleMemberChange(idx, 'firstName', e.target.value)}
                          placeholder="First Name"
                          required
                          className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={m.lastName}
                          onChange={(e) => handleMemberChange(idx, 'lastName', e.target.value)}
                          placeholder="Last Name"
                          required
                          className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>

                    {/* Roles Checkboxes */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Assigned Roles (Select one or more):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {AVAILABLE_ROLES.map((r) => {
                          const isChecked = m.roles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => handleToggleMemberRole(idx, r)}
                              className={`px-2 py-1 text-xs rounded-md border font-medium transition-all ${
                                isChecked
                                  ? r === 'Project Manager'
                                    ? 'bg-purple-600 border-purple-600 text-white'
                                    : 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Normalized Username Live Preview */}
                    {autoUsername && (
                      <div className="text-[11px] text-slate-500 bg-white p-1.5 rounded border border-slate-200">
                        Generated Username: <span className="font-mono font-semibold text-slate-800">@{autoUsername}</span> &bull; Default Password: <span className="font-mono text-slate-700">{autoUsername}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingGroupId ? 'Save Group Updates' : 'Create Group & Generate Credentials'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Generated Student Credentials Distribution Modal */}
      {credentialsModalData && (
        <Modal
          isOpen={true}
          onClose={() => setCredentialsModalData(null)}
          title="Generated Student Credentials for Distribution"
          subtitle={credentialsModalData.groupTitle}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Credentials Ready for Distribution:</strong> Usernames and default passwords are set to <code>firstname.lastname</code>. Students will be prompted to change their password upon initial sign-in.
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5">Username</th>
                    <th className="p-2.5">Default Password</th>
                    <th className="p-2.5">Assigned Roles</th>
                    <th className="p-2.5 text-right">Copy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {credentialsModalData.credentials.map((cred, i) => {
                    const copyText = `Student: ${cred.name}\nUsername: ${cred.username}\nDefault Password: ${cred.defaultPassword}\nRoles: ${cred.roles}`;
                    const isCopied = copiedKey === cred.username;

                    return (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-medium text-slate-900">{cred.name}</td>
                        <td className="p-2.5 font-mono text-indigo-700">{cred.username}</td>
                        <td className="p-2.5 font-mono text-slate-700 bg-slate-50">{cred.defaultPassword}</td>
                        <td className="p-2.5 text-slate-600">{cred.roles}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(copyText);
                              setCopiedKey(cred.username);
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                            title="Copy credentials block"
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  const allText = credentialsModalData.credentials
                    .map(
                      (c) =>
                        `Student: ${c.name}\nUsername: ${c.username}\nPassword: ${c.defaultPassword}\nRoles: ${c.roles}\n---`
                    )
                    .join('\n');
                  navigator.clipboard.writeText(allText);
                  setCopiedKey('all');
                  setTimeout(() => setCopiedKey(null), 2000);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                {copiedKey === 'all' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                Copy All Group Credentials
              </button>

              <button
                type="button"
                onClick={() => setCredentialsModalData(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Group Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteGroup}
        onClose={() => setConfirmDeleteGroup(null)}
        onConfirm={handleExecuteDeleteGroup}
        title="Delete Capstone Group"
        message={`Are you sure you want to delete group "${confirmDeleteGroup?.title}"? This will remove all associated member registrations.`}
        confirmLabel="Delete Group"
      />
    </div>
  );
};
