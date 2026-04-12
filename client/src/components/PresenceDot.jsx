import usePresence from '../hooks/usePresence.js';

const PresenceDot = ({ userId }) => {
  const isOnline = usePresence(userId);

  return (
    <span
      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
        isOnline ? 'bg-green-500 presence-online' : 'bg-slate-500'
      }`}
    />
  );
};

export default PresenceDot;
