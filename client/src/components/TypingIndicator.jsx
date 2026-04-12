import useChatStore from '../store/chatStore.js';

const TypingIndicator = ({ chatId }) => {
  const typingUsers = useChatStore((s) => s.typingUsers[chatId] || []);

  if (typingUsers.length === 0) return null;

  let label;
  if (typingUsers.length === 1) {
    label = `${typingUsers[0].name} is typing`;
  } else if (typingUsers.length === 2) {
    label = `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
  } else {
    label = 'Several people are typing';
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-slate-400">
      <div className="flex items-center gap-0.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span>{label}</span>
    </div>
  );
};

export default TypingIndicator;
