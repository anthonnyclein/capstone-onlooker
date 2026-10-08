import React, { useState } from 'react';
import { Office, SubOffice, Group } from '../../types';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronRight,
  AlertCircle,
  FolderTree,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface OfficesViewProps {
  offices: Office[];
  groups: Group[];
  onSaveOffices: (offices: Office[]) => void;
  onSelectGroup?: (groupId: string) => void;
}

export const OfficesView: React.FC<OfficesViewProps> = ({
  offices,
  groups,
  onSaveOffices,
  onSelectGroup,
}) => {
  // Office modal
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [officeName, setOfficeName] = useState('');
  const [officeCode, setOfficeCode] = useState('');
  const [officeError, setOfficeError] = useState('');

  // Sub-office modal
  const [isSubOfficeModalOpen, setIsSubOfficeModalOpen] = useState(false);
  const [targetOfficeId, setTargetOfficeId] = useState<string>('');
  const [editingSubOffice, setEditingSubOffice] = useState<SubOffice | null>(null);
  const [subOfficeName, setSubOfficeName] = useState('');
  const [subOfficeCode, setSubOfficeCode] = useState('');
  const [subOfficeError, setSubOfficeError] = useState('');

  // Confirmation deletion dialogs
  const [confirmDeleteOffice, setConfirmDeleteOffice] = useState<Office | null>(null);
  const [confirmDeleteSubOffice, setConfirmDeleteSubOffice] = useState<{
    officeId: string;
    subOffice: SubOffice;
  } | null>(null);
  const [blockedDeleteMsg, setBlockedDeleteMsg] = useState<string | null>(null);

  // Selected Office / SubOffice to view associated groups
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(
    offices[0]?.id || ''
  );
  const [selectedSubOfficeId, setSelectedSubOfficeId] = useState<string>('all');

  const currentOffice = offices.find((o) => o.id === selectedOfficeId);

  // Count groups assigned to office / sub-office
  const getGroupsForOffice = (offId: string) =>
    groups.filter((g) => g.officeId === offId);

  const getGroupsForSubOffice = (offId: string, subId: string) =>
    groups.filter((g) => g.officeId === offId && g.subOfficeId === subId);

  // Office CRUD Handlers
  const handleOpenOfficeModal = (office?: Office) => {
    setOfficeError('');
    if (office) {
      setEditingOffice(office);
      setOfficeName(office.name);
      setOfficeCode(office.code);
    } else {
      setEditingOffice(null);
      setOfficeName('');
      setOfficeCode('');
    }
    setIsOfficeModalOpen(true);
  };

  const handleSaveOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officeName.trim() || !officeCode.trim()) {
      setOfficeError('Please provide both the office name and code.');
      return;
    }

    if (editingOffice) {
      const updated = offices.map((o) =>
        o.id === editingOffice.id
          ? { ...o, name: officeName.trim(), code: officeCode.trim().toUpperCase() }
          : o
      );
      onSaveOffices(updated);
    } else {
      const newOffice: Office = {
        id: `off-${Date.now()}`,
        name: officeName.trim(),
        code: officeCode.trim().toUpperCase(),
        subOffices: [],
      };
      onSaveOffices([...offices, newOffice]);
      setSelectedOfficeId(newOffice.id);
    }

    setIsOfficeModalOpen(false);
  };

  const handleDeleteOfficeClick = (office: Office) => {
    const assigned = getGroupsForOffice(office.id);
    if (assigned.length > 0) {
      setBlockedDeleteMsg(
        `Cannot delete "${office.name}". There are currently ${assigned.length} capstone group(s) assigned to this Office. Please reassign or remove the groups before deleting.`
      );
      return;
    }
    setConfirmDeleteOffice(office);
  };

  const handleExecuteDeleteOffice = () => {
    if (!confirmDeleteOffice) return;
    const updated = offices.filter((o) => o.id !== confirmDeleteOffice.id);
    onSaveOffices(updated);
    if (selectedOfficeId === confirmDeleteOffice.id) {
      setSelectedOfficeId(updated[0]?.id || '');
    }
    setConfirmDeleteOffice(null);
  };

  // SubOffice CRUD Handlers
  const handleOpenSubOfficeModal = (officeId: string, subOffice?: SubOffice) => {
    setSubOfficeError('');
    setTargetOfficeId(officeId);
    if (subOffice) {
      setEditingSubOffice(subOffice);
      setSubOfficeName(subOffice.name);
      setSubOfficeCode(subOffice.code);
    } else {
      setEditingSubOffice(null);
      setSubOfficeName('');
      setSubOfficeCode('');
    }
    setIsSubOfficeModalOpen(true);
  };

  const handleSaveSubOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subOfficeName.trim() || !subOfficeCode.trim()) {
      setSubOfficeError('Please provide both the sub-office name and code.');
      return;
    }

    const updated = offices.map((o) => {
      if (o.id !== targetOfficeId) return o;

      if (editingSubOffice) {
        return {
          ...o,
          subOffices: o.subOffices.map((sub) =>
            sub.id === editingSubOffice.id
              ? {
                  ...sub,
                  name: subOfficeName.trim(),
                  code: subOfficeCode.trim().toUpperCase(),
                }
              : sub
          ),
        };
      } else {
        const newSub: SubOffice = {
          id: `sub-${Date.now()}`,
          officeId: targetOfficeId,
          name: subOfficeName.trim(),
          code: subOfficeCode.trim().toUpperCase(),
        };
        return { ...o, subOffices: [...o.subOffices, newSub] };
      }
    });

    onSaveOffices(updated);
    setIsSubOfficeModalOpen(false);
  };

  const handleDeleteSubOfficeClick = (officeId: string, subOffice: SubOffice) => {
    const assigned = getGroupsForSubOffice(officeId, subOffice.id);
    if (assigned.length > 0) {
      setBlockedDeleteMsg(
        `Cannot delete Sub-office "${subOffice.name}". There are ${assigned.length} group(s) assigned to it. Reassign or remove these groups first.`
      );
      return;
    }
    setConfirmDeleteSubOffice({ officeId, subOffice });
  };

  const handleExecuteDeleteSubOffice = () => {
    if (!confirmDeleteSubOffice) return;
    const { officeId, subOffice } = confirmDeleteSubOffice;

    const updated = offices.map((o) => {
      if (o.id !== officeId) return o;
      return {
        ...o,
        subOffices: o.subOffices.filter((s) => s.id !== subOffice.id),
      };
    });

    onSaveOffices(updated);
    setConfirmDeleteSubOffice(null);
  };

  // Associated groups to display
  const displayedGroups = currentOffice
    ? groups.filter((g) => {
        if (g.officeId !== currentOffice.id) return false;
        if (selectedSubOfficeId !== 'all' && g.subOfficeId !== selectedSubOfficeId) return false;
        return true;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Offices & Sub-offices Management
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure institutional hierarchies, colleges, departments, and inspect associated capstone groups.
          </p>
        </div>
        <button
          onClick={() => handleOpenOfficeModal()}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Create New Office
        </button>
      </div>

      {/* Main Layout: Left Office List & Right Sub-Offices / Groups Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Offices List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" />
            University Offices ({offices.length})
          </div>

          <div className="space-y-2">
            {offices.map((office) => {
              const isSelected = selectedOfficeId === office.id;
              const assignedGroups = getGroupsForOffice(office.id);

              return (
                <div
                  key={office.id}
                  onClick={() => {
                    setSelectedOfficeId(office.id);
                    setSelectedSubOfficeId('all');
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {office.code}
                        </span>
                        <span className="text-xs text-slate-500">
                          {office.subOffices.length} Sub-offices
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">
                        {office.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenOfficeModal(office);
                        }}
                        title="Edit Office"
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOfficeClick(office);
                        }}
                        title="Delete Office"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {assignedGroups.length} assigned group(s)
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-indigo-600 translate-x-0.5' : 'text-slate-300'
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Sub-Offices and Associated Groups for Selected Office */}
        <div className="lg:col-span-8 space-y-6">
          {currentOffice ? (
            <div className="space-y-6">
              {/* Sub-offices Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Sub-offices in {currentOffice.code}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {currentOffice.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleOpenSubOfficeModal(currentOffice.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Sub-office
                  </button>
                </div>

                {/* Sub-offices List */}
                <div className="mt-4 space-y-2">
                  {currentOffice.subOffices.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      No sub-offices created yet under this office.
                    </div>
                  ) : (
                    currentOffice.subOffices.map((sub) => {
                      const subGroups = getGroupsForSubOffice(currentOffice.id, sub.id);
                      const isFilterActive = selectedSubOfficeId === sub.id;

                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-lg border transition-all flex items-center justify-between ${
                            isFilterActive
                              ? 'bg-slate-50 border-indigo-400 ring-1 ring-indigo-400'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {sub.code}
                            </span>
                            <div>
                              <span className="text-xs font-semibold text-slate-900 block">
                                {sub.name}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {subGroups.length} associated group(s)
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedSubOfficeId(isFilterActive ? 'all' : sub.id)
                              }
                              className={`text-[11px] px-2 py-1 rounded font-medium ${
                                isFilterActive
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                              }`}
                            >
                              {isFilterActive ? 'Showing Groups' : 'Filter Groups'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSubOfficeModal(currentOffice.id, sub)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubOfficeClick(currentOffice.id, sub)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Associated Groups Section */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-slate-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Associated Capstone Groups ({displayedGroups.length})
                    </h4>
                  </div>
                  {selectedSubOfficeId !== 'all' && (
                    <button
                      onClick={() => setSelectedSubOfficeId('all')}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Clear Sub-office filter
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {displayedGroups.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      No capstone groups currently registered under this filter.
                    </div>
                  ) : (
                    displayedGroups.map((grp) => {
                      const subOffice = currentOffice.subOffices.find(
                        (s) => s.id === grp.subOfficeId
                      );
                      return (
                        <div
                          key={grp.id}
                          className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                        >
                          <div>
                            <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wide block">
                              {subOffice?.name || 'General Sub-office'}
                            </span>
                            <h5 className="text-sm font-bold text-slate-900 mt-0.5">
                              {grp.title}
                            </h5>
                            <p className="text-xs text-slate-600 mt-1">
                              <strong>Client:</strong> {grp.clientNames.join(', ')}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {grp.members.map((m) => (
                                <span
                                  key={m.id}
                                  className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-700"
                                >
                                  {m.firstName} {m.lastName} ({m.roles.join(', ')})
                                </span>
                              ))}
                            </div>
                          </div>

                          {onSelectGroup && (
                            <button
                              onClick={() => onSelectGroup(grp.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded transition-all shrink-0"
                            >
                              View Group &rarr;
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
              Please select or create an office to view details.
            </div>
          )}
        </div>
      </div>

      {/* Office Modal */}
      <Modal
        isOpen={isOfficeModalOpen}
        onClose={() => setIsOfficeModalOpen(false)}
        title={editingOffice ? 'Edit Office' : 'Create New Office'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveOffice} className="space-y-4">
          {officeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
              {officeError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Office Name
            </label>
            <input
              type="text"
              value={officeName}
              onChange={(e) => setOfficeName(e.target.value)}
              placeholder="e.g. Office of the Vice Chancellor for Academic Affairs"
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Office Code / Acronym
            </label>
            <input
              type="text"
              value={officeCode}
              onChange={(e) => setOfficeCode(e.target.value)}
              placeholder="e.g. OVCAA"
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsOfficeModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingOffice ? 'Save Changes' : 'Create Office'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Sub-office Modal */}
      <Modal
        isOpen={isSubOfficeModalOpen}
        onClose={() => setIsSubOfficeModalOpen(false)}
        title={editingSubOffice ? 'Edit Sub-office' : 'Add Sub-office'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveSubOffice} className="space-y-4">
          {subOfficeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-lg">
              {subOfficeError}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sub-office / College / Department Name
            </label>
            <input
              type="text"
              value={subOfficeName}
              onChange={(e) => setSubOfficeName(e.target.value)}
              placeholder="e.g. College of Business and Information Technology"
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sub-office Code / Acronym
            </label>
            <input
              type="text"
              value={subOfficeCode}
              onChange={(e) => setSubOfficeCode(e.target.value)}
              placeholder="e.g. CBIT"
              required
              className="w-full text-xs p-2 border border-slate-300 rounded-lg uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSubOfficeModalOpen(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              {editingSubOffice ? 'Save Sub-office' : 'Add Sub-office'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Blocked Deletion Notice Dialog */}
      {blockedDeleteMsg && (
        <Modal
          isOpen={true}
          onClose={() => setBlockedDeleteMsg(null)}
          title="Deletion Restrained: Assigned Groups Exist"
          maxWidth="md"
        >
          <div className="flex gap-3 items-start pt-1 pb-2">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">{blockedDeleteMsg}</p>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setBlockedDeleteMsg(null)}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
            >
              Understood
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm Delete Office Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDeleteOffice}
        onClose={() => setConfirmDeleteOffice(null)}
        onConfirm={handleExecuteDeleteOffice}
        title="Delete Office Confirmation"
        message={`Are you sure you want to permanently delete "${confirmDeleteOffice?.name}"? All empty sub-offices underneath will also be deleted.`}
        confirmLabel="Delete Office"
      />

      {/* Confirm Delete SubOffice Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDeleteSubOffice}
        onClose={() => setConfirmDeleteSubOffice(null)}
        onConfirm={handleExecuteDeleteSubOffice}
        title="Delete Sub-office Confirmation"
        message={`Are you sure you want to delete Sub-office "${confirmDeleteSubOffice?.subOffice.name}"?`}
        confirmLabel="Delete Sub-office"
      />
    </div>
  );
};
