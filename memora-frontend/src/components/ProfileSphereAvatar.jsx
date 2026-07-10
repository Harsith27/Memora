import React from 'react';

export const PROFILE_SPHERE_THEMES = [
  { id: 'sphere-1', name: 'Midnight Plum', gradient: 'radial-gradient(circle at 24% 20%, rgba(125,93,173,0.38) 0%, rgba(125,93,173,0) 42%), linear-gradient(145deg, #0b1020 0%, #1a1533 42%, #3a224d 100%)' },
  { id: 'sphere-2', name: 'Deep Aurora', gradient: 'radial-gradient(circle at 70% 24%, rgba(85,215,196,0.3) 0%, rgba(85,215,196,0) 42%), linear-gradient(145deg, #07111c 0%, #11273b 44%, #133b4e 100%)' },
  { id: 'sphere-3', name: 'Obsidian Rose', gradient: 'radial-gradient(circle at 50% 44%, rgba(189,94,141,0.28) 0%, rgba(189,94,141,0) 44%), linear-gradient(145deg, #0f0b14 0%, #231224 46%, #40192e 100%)' },
  { id: 'sphere-4', name: 'Night Tide', gradient: 'radial-gradient(circle at 20% 28%, rgba(61,162,190,0.24) 0%, rgba(61,162,190,0) 46%), linear-gradient(145deg, #07131d 0%, #0f2334 48%, #16354d 100%)' },
  { id: 'sphere-5', name: 'Ink Violet', gradient: 'radial-gradient(circle at 76% 18%, rgba(156,113,255,0.24) 0%, rgba(156,113,255,0) 42%), linear-gradient(145deg, #090a16 0%, #17142b 44%, #2d2154 100%)' },
  { id: 'sphere-6', name: 'Smoke Ember', gradient: 'radial-gradient(circle at 30% 34%, rgba(255,132,92,0.2) 0%, rgba(255,132,92,0) 44%), linear-gradient(145deg, #100d12 0%, #24161d 42%, #432628 100%)' },
  { id: 'sphere-7', name: 'Cosmic Moss', gradient: 'radial-gradient(circle at 80% 70%, rgba(132,230,167,0.24) 0%, rgba(132,230,167,0) 46%), linear-gradient(145deg, #08110d 0%, #13231b 44%, #20392c 100%)' },
  { id: 'sphere-8', name: 'Dusk Ruby', gradient: 'radial-gradient(circle at 28% 52%, rgba(255,92,126,0.24) 0%, rgba(255,92,126,0) 44%), linear-gradient(145deg, #120910 0%, #2a121f 45%, #47172a 100%)' },
  { id: 'sphere-9', name: 'Shadow Cobalt', gradient: 'radial-gradient(circle at 68% 30%, rgba(87,143,255,0.24) 0%, rgba(87,143,255,0) 44%), linear-gradient(145deg, #070d18 0%, #112040 45%, #203e6d 100%)' },
  { id: 'sphere-10', name: 'Nocturne Mint', gradient: 'radial-gradient(circle at 74% 28%, rgba(102,240,214,0.24) 0%, rgba(102,240,214,0) 42%), linear-gradient(145deg, #07110f 0%, #10231e 44%, #17413a 100%)' },
  { id: 'sphere-11', name: 'Black Orchid', gradient: 'radial-gradient(circle at 52% 24%, rgba(197,113,255,0.22) 0%, rgba(197,113,255,0) 42%), linear-gradient(145deg, #08070d 0%, #17111f 46%, #2f183f 100%)' },
  { id: 'sphere-12', name: 'Slate Flame', gradient: 'radial-gradient(circle at 22% 22%, rgba(255,167,102,0.22) 0%, rgba(255,167,102,0) 42%), linear-gradient(145deg, #0d1018 0%, #1d232f 45%, #3a2c25 100%)' },
  { id: 'sphere-13', name: 'Deep Lagoon', gradient: 'radial-gradient(circle at 74% 72%, rgba(80,172,255,0.24) 0%, rgba(80,172,255,0) 44%), linear-gradient(145deg, #061219 0%, #0d2635 46%, #14455f 100%)' },
  { id: 'sphere-14', name: 'Velvet Steel', gradient: 'radial-gradient(circle at 30% 20%, rgba(165,174,255,0.2) 0%, rgba(165,174,255,0) 42%), linear-gradient(145deg, #0b0d14 0%, #182030 44%, #2f3b54 100%)' },
  { id: 'sphere-15', name: 'Graphite Prism', gradient: 'radial-gradient(circle at 48% 28%, rgba(124,225,255,0.18) 0%, rgba(124,225,255,0) 40%), linear-gradient(145deg, #07090d 0%, #131922 46%, #243044 100%)' }
];

const SIZE_STYLES = {
  sm: {
    shell: 'w-8 h-8',
    radius: 'rounded-full'
  },
  md: {
    shell: 'w-10 h-10',
    radius: 'rounded-full'
  },
  lg: {
    shell: 'w-16 h-16',
    radius: 'rounded-full'
  },
  xl: {
    shell: 'w-20 h-20',
    radius: 'rounded-full'
  }
};

const getTheme = (iconId) => {
  return PROFILE_SPHERE_THEMES.find((item) => item.id === iconId) || PROFILE_SPHERE_THEMES[0];
};

const getAvatarInitials = (username) => {
  const normalized = String(username || '').trim();
  if (!normalized) return 'u';

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${(words[0][0] || '').toLowerCase()}${(words[1][0] || '').toLowerCase()}`;
  }

  return normalized.slice(0, 2).toLowerCase();
};

const getThemeLuminance = (gradient) => {
  const matches = String(gradient || '').match(/#(?:[0-9a-fA-F]{3}){1,2}/g) || [];
  if (matches.length === 0) return 0;

  const toRgb = (hex) => {
    const normalizedHex = hex.replace('#', '');
    const expanded = normalizedHex.length === 3
      ? normalizedHex.split('').map((char) => char + char).join('')
      : normalizedHex;
    const numeric = Number.parseInt(expanded, 16);
    return {
      r: (numeric >> 16) & 255,
      g: (numeric >> 8) & 255,
      b: numeric & 255
    };
  };

  const toLinear = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return matches.reduce((sum, hex) => {
    const { r, g, b } = toRgb(hex);
    return sum + ((0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b)));
  }, 0) / matches.length;
};

const ProfileSphereAvatar = ({ iconId = 'sphere-1', username = '', size = 'md', className = '', title }) => {
  const theme = getTheme(iconId);
  const resolvedSize = SIZE_STYLES[size] || SIZE_STYLES.md;
  const initials = getAvatarInitials(username);
  const useDarkText = getThemeLuminance(theme.gradient) >= 0.55;
  const textColor = useDarkText ? '#111111' : '#ffffff';
  const fontSize = size === 'sm' ? '0.78rem' : size === 'md' ? '0.92rem' : size === 'lg' ? '1.28rem' : '1.48rem';

  return (
    <div
      className={`relative ${resolvedSize.shell} ${resolvedSize.radius} border border-white/15 shadow-[0_10px_24px_rgba(0,0,0,0.42)] overflow-hidden ${className}`}
      style={{ backgroundImage: theme.gradient }}
      title={title || theme.name}
      aria-label={title || theme.name}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_30%,rgba(0,0,0,0.08)_72%,rgba(0,0,0,0.16)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_38%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_78%,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0)_54%)]" />
      <div
        className="absolute inset-0 flex items-center justify-center select-none font-normal tracking-normal"
         style={{ color: textColor, fontSize, textShadow: useDarkText ? '0 1px 1px rgba(255,255,255,0.12)' : '0 1px 1px rgba(0,0,0,0.35)' }}
      >
        {initials}
      </div>
    </div>
  );
};

export const getProfileSphereName = (iconId) => getTheme(iconId).name;

export default ProfileSphereAvatar;
