import React from 'react';

export const PROFILE_SPHERE_THEMES = [
  { id: 'sphere-1', name: 'Blush Mist', gradient: 'radial-gradient(circle at 24% 20%, #ffd7db 0%, #f39fb5 34%, #de7ea0 62%, #bf6f91 100%), linear-gradient(135deg, #2b1f33 0%, #4a2f58 100%)' },
  { id: 'sphere-2', name: 'Violet Drift', gradient: 'linear-gradient(140deg, #8d4ce9 0%, #b364ff 35%, #f1b95d 100%)' },
  { id: 'sphere-3', name: 'Solar Ember', gradient: 'radial-gradient(circle at 52% 54%, #ff4f64 0%, #ff8f3e 26%, #f8cb76 56%, #d8b891 100%), linear-gradient(180deg, #4a2b20 0%, #785138 100%)' },
  { id: 'sphere-4', name: 'Aurora Tide', gradient: 'linear-gradient(140deg, #25115f 0%, #1f6aa3 40%, #86f19e 76%, #ffe884 100%)' },
  { id: 'sphere-5', name: 'Indigo Pulse', gradient: 'linear-gradient(145deg, #d0c5ff 0%, #8f84dd 40%, #5642bf 72%, #2f1a86 100%)' },
  { id: 'sphere-6', name: 'Neon Bloom', gradient: 'radial-gradient(circle at 18% 28%, #ffb48a 0%, rgba(255,180,138,0.26) 44%, rgba(255,180,138,0) 62%), linear-gradient(145deg, #1ea5d8 0%, #63d8f6 38%, #ce4bff 100%)' },
  { id: 'sphere-7', name: 'Prism Veil', gradient: 'linear-gradient(140deg, #b078ff 0%, #7bc3ff 48%, #5df6d4 100%), radial-gradient(circle at 80% 70%, #7a2aff 0%, rgba(122,42,255,0) 60%)' },
  { id: 'sphere-8', name: 'Magenta Storm', gradient: 'radial-gradient(circle at 30% 50%, #ff7f57 0%, #ff3d6f 34%, #ee2f8a 70%, #c4308e 100%), linear-gradient(145deg, #2d0c3d 0%, #5f1b66 100%)' },
  { id: 'sphere-9', name: 'Electric Peach', gradient: 'linear-gradient(145deg, #ff5f6d 0%, #ff8f56 34%, #ffcf63 72%, #6168ff 100%)' },
  { id: 'sphere-10', name: 'Cyan Orbit', gradient: 'radial-gradient(circle at 72% 32%, #66f5ff 0%, rgba(102,245,255,0.08) 40%, rgba(102,245,255,0) 66%), linear-gradient(145deg, #1f0f73 0%, #1a5ca1 46%, #5fe89e 100%)' },
  { id: 'sphere-11', name: 'Sunset Haze', gradient: 'linear-gradient(145deg, #ff7f5f 0%, #ff5895 36%, #d34bf0 72%, #6a42d9 100%)' },
  { id: 'sphere-12', name: 'Lunar Mint', gradient: 'radial-gradient(circle at 82% 18%, #f6fbff 0%, rgba(246,251,255,0.24) 28%, rgba(246,251,255,0) 52%), linear-gradient(145deg, #5c76d9 0%, #76b6ff 45%, #88f0d8 100%)' },
  { id: 'sphere-13', name: 'Coral Flux', gradient: 'linear-gradient(145deg, #ff6e5b 0%, #ff3f8d 34%, #7e44d8 72%, #3a56bf 100%)' },
  { id: 'sphere-14', name: 'Sapphire Dawn', gradient: 'radial-gradient(circle at 26% 24%, #ffca72 0%, rgba(255,202,114,0.28) 34%, rgba(255,202,114,0) 54%), linear-gradient(145deg, #305cff 0%, #3d88ff 42%, #8d4eff 100%)' },
  { id: 'sphere-15', name: 'Velvet Rainbow', gradient: 'linear-gradient(145deg, #ff5f7f 0%, #ff8060 28%, #ffcc5a 52%, #5dd7d6 76%, #5f5bff 100%)' }
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
  if (!normalized) return 'U';

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
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
      className={`relative ${resolvedSize.shell} ${resolvedSize.radius} border border-white/30 shadow-[0_8px_18px_rgba(0,0,0,0.35)] overflow-hidden ${className}`}
      style={{ backgroundImage: theme.gradient }}
      title={title || theme.name}
      aria-label={title || theme.name}
    >
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.36)_0%,rgba(255,255,255,0.08)_32%,rgba(255,255,255,0)_58%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_80%,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0)_56%)]" />
      <div className="absolute -top-[24%] left-[12%] h-[52%] w-[76%] rounded-full bg-white/30 blur-[2px]" />
      <div className="absolute bottom-[8%] right-[8%] h-[34%] w-[34%] rounded-full bg-black/10 blur-[4px]" />
      <div
        className="absolute inset-0 flex items-center justify-center select-none font-normal tracking-normal"
         style={{ color: textColor, fontSize, textShadow: useDarkText ? '0 1px 1px rgba(255,255,255,0.12)' : '0 1px 1px rgba(0,0,0,0.28)' }}
      >
        {initials}
      </div>
    </div>
  );
};

export const getProfileSphereName = (iconId) => getTheme(iconId).name;

export default ProfileSphereAvatar;
