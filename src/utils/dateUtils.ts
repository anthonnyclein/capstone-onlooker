/**
 * Date and Time utilities formatted for Asia/Manila timezone (UTC+8).
 */

export const TIMEZONE = 'Asia/Manila';

export function formatDateTime(isoString: string): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' (PHT)';
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTime(isoString: string): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Calculates days late: each started 24-hour period after deadline counts as 1 day late.
 */
export function calculateDaysLate(submissionTimeIso: string, deadlineIso: string): number {
  const subDate = new Date(submissionTimeIso);
  const deadDate = new Date(deadlineIso);

  const diffMs = subDate.getTime() - deadDate.getTime();
  if (diffMs <= 0) {
    return 0;
  }

  // Count each started 24-hour period after the deadline
  const msInDay = 24 * 60 * 60 * 1000;
  return Math.ceil(diffMs / msInDay);
}

export function isPastDeadline(deadlineIso: string): boolean {
  const deadDate = new Date(deadlineIso);
  return new Date().getTime() > deadDate.getTime();
}

export const isDeadlinePassed = isPastDeadline;

export function getCurrentManilaTimeString(): string {
  return new Date().toISOString();
}

/**
 * Returns input formatted for datetime-local in Asia/Manila (or local)
 */
export function toDateTimeLocalValue(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}
