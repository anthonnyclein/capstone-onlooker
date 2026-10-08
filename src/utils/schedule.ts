import type { DefenseAttempt } from '../types';

export function validateSchedule(candidate: Pick<DefenseAttempt, 'groupId' | 'defenseDate' | 'defenseTime' | 'venue' | 'panelMemberIds' | 'leadPanelId'>, attempts: DefenseAttempt[], editingId?: string): string | null {
  if (!candidate.groupId) return 'Please select a student group.';
  if (!candidate.defenseDate || !candidate.defenseTime) return 'Please select a defense date and time.';
  if (!candidate.venue.trim()) return 'Please enter a venue.';
  if (!candidate.panelMemberIds.length) return 'Please assign at least one panel member.';
  if (!candidate.panelMemberIds.includes(candidate.leadPanelId)) return 'The lead panel must be on the assigned committee.';
  for (const other of attempts) {
    if (other.id === editingId || other.defenseDate !== candidate.defenseDate || other.defenseTime !== candidate.defenseTime) continue;
    if (other.groupId === candidate.groupId) return 'This group already has a defense at this date and time.';
    if (other.panelMemberIds.some(id => candidate.panelMemberIds.includes(id))) return 'An assigned panel member already has a defense at this date and time.';
    if (other.venue.trim().toLowerCase() === candidate.venue.trim().toLowerCase()) return 'This venue already has a defense at this date and time.';
  }
  return null;
}
