/**
 * Utilities for normalizing student, panel, and coordinator credentials and usernames.
 */

export function normalizeUsername(firstName: string, lastName: string): string {
  const cleanFirst = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanLast = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanFirst && !cleanLast) return '';
  if (!cleanFirst) return cleanLast;
  if (!cleanLast) return cleanFirst;
  return `${cleanFirst}.${cleanLast}`;
}

export function getDefaultPassword(usernameOrFirstName: string, lastName?: string): string {
  if (lastName !== undefined && lastName.trim() !== '') {
    return normalizeUsername(usernameOrFirstName, lastName);
  }
  return usernameOrFirstName.trim().toLowerCase();
}

/**
 * Checks for username uniqueness among existing members and user accounts.
 * Returns null if unique, or an error message if duplicate.
 */
export function checkUsernameConflict(
  proposedUsername: string,
  existingUsernames: string[],
  currentMemberId?: string,
  memberIdMap?: Record<string, string> // username -> memberId
): string | null {
  const normalized = proposedUsername.trim().toLowerCase();
  
  if (!normalized || normalized === '.') {
    return 'Username cannot be empty.';
  }

  const conflict = existingUsernames.some(u => {
    if (u.toLowerCase() === normalized) {
      if (currentMemberId && memberIdMap && memberIdMap[u.toLowerCase()] === currentMemberId) {
        return false; // Same user updating their profile
      }
      return true;
    }
    return false;
  });

  if (conflict) {
    return `Username conflict: "${normalized}" is already registered by another student. Please adjust the first or last name to resolve uniqueness before saving.`;
  }

  return null;
}
