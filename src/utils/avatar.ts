/**
 * Avatar generation and initials utility
 */

export interface AvatarColorPreset {
  id: string;
  name: string;
  bgColor: string; // Tailwind class
  hexColor: string;
  textColor: string;
}

export const AVATAR_COLOR_PRESETS: AvatarColorPreset[] = [
  {
    id: 'orange',
    name: 'University Orange',
    bgColor: 'bg-orange-600',
    hexColor: '#ea580c',
    textColor: '#ffffff',
  },
  {
    id: 'indigo',
    name: 'Academic Indigo',
    bgColor: 'bg-indigo-600',
    hexColor: '#4f46e5',
    textColor: '#ffffff',
  },
  {
    id: 'emerald',
    name: 'Faculty Emerald',
    bgColor: 'bg-emerald-600',
    hexColor: '#059669',
    textColor: '#ffffff',
  },
  {
    id: 'purple',
    name: 'Royal Violet',
    bgColor: 'bg-purple-600',
    hexColor: '#7c3aed',
    textColor: '#ffffff',
  },
  {
    id: 'slate',
    name: 'Executive Slate',
    bgColor: 'bg-slate-700',
    hexColor: '#334155',
    textColor: '#ffffff',
  },
  {
    id: 'amber',
    name: 'Honor Amber',
    bgColor: 'bg-amber-600',
    hexColor: '#d97706',
    textColor: '#ffffff',
  },
];

export function getInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  if (f && l) return `${f}${l}`;
  if (f) return f;
  if (l) return l;
  return 'PA'; // Fallback Panelist initials
}

/**
 * Generates an SVG data URL for a circular initials avatar.
 */
export function generateInitialsAvatarSvg(
  firstName: string,
  lastName: string,
  bgColor: string = '#ea580c',
  textColor: string = '#ffffff'
): string {
  const initials = getInitials(firstName, lastName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="50" fill="${bgColor}"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" font-weight="700" font-size="38" letter-spacing="1">
      ${initials}
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
