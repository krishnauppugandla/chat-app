// Derives a consistent background color from a name string
const nameToColor = (name) => {
  const colors = [
    'bg-rose-600', 'bg-orange-600', 'bg-amber-600',
    'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600',
    'bg-blue-600', 'bg-violet-600', 'bg-fuchsia-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const Avatar = ({ name = '', avatarUrl, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-lg',
  };

  const initial = name?.charAt(0)?.toUpperCase() || '?';
  const colorClass = nameToColor(name || '?');

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
    >
      {initial}
    </div>
  );
};

export default Avatar;
