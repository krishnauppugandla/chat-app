import { useState, useEffect } from 'react';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import Avatar from './Avatar.jsx';
import PresenceDot from './PresenceDot.jsx';
import useChatStore from '../store/chatStore.js';
import { useAuth } from '../context/AuthContext.jsx';

const formatChatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) return format(date, 'EEE');
  return format(date, 'dd/MM/yy');
};

const ChatSkeleton = () => (
  <div className="flex items-center gap-3 px-3 py-3 mx-2">
    <div className="w-10 h-10 rounded-full skeleton-bar flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="flex justify-between">
        <div className="h-3.5 w-24 skeleton-bar rounded" />
        <div className="h-3 w-8 skeleton-bar rounded" />
      </div>
      <div className="h-3 w-40 skeleton-bar rounded" />
    </div>
  </div>
);

const ChatItem = ({ chat, isActive, onClick, currentUserId }) => {
  const otherMember = !chat.is_group
    ? chat.members?.find((m) => m.user_id !== currentUserId)
    : null;

  const displayName = chat.is_group
    ? chat.name
    : otherMember?.user?.name || 'Unknown';

  const avatarUrl = chat.is_group
    ? chat.avatar_url
    : otherMember?.user?.avatar_url;

  const lastMsg = chat.last_message;
  const lastMsgText = lastMsg
    ? lastMsg.is_deleted
      ? 'Message deleted'
      : lastMsg.type === 'image'
      ? '📷 Image'
      : lastMsg.content?.length > 42
      ? lastMsg.content.slice(0, 42) + '…'
      : lastMsg.content
    : 'No messages yet';

  const timestamp = formatChatTime(chat.updated_at || chat.created_at);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 mx-2 rounded-xl transition-all duration-150 text-left group ${
        isActive
          ? 'bg-blue-600/15 border border-blue-500/20'
          : 'hover:bg-slate-800 border border-transparent'
      }`}
      style={{ width: 'calc(100% - 16px)' }}
    >
      <div className="relative flex-shrink-0">
        <Avatar name={displayName} avatarUrl={avatarUrl} size="md" />
        {!chat.is_group && otherMember && (
          <PresenceDot userId={otherMember.user_id} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={`text-sm font-medium truncate ${isActive ? 'text-slate-100' : 'text-slate-200 group-hover:text-slate-100'}`}>
            {displayName}
          </span>
          <span className="text-[11px] text-slate-500 flex-shrink-0">{timestamp}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs truncate ${lastMsg?.is_deleted ? 'italic text-slate-600' : 'text-slate-500'}`}>
            {lastMsg && !lastMsg.is_deleted && lastMsg.sender?.id === currentUserId && (
              <span className="text-slate-600 mr-1">You:</span>
            )}
            {lastMsgText}
          </span>
          {chat.unread_count > 0 && (
            <span className="flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1">
              {chat.unread_count > 99 ? '99+' : chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const Sidebar = ({ onNewChat, loading }) => {
  const [query, setQuery] = useState('');
  const { chats, activeChat, setActiveChat } = useChatStore();
  const { user, logout } = useAuth();

  const filtered = chats.filter((chat) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    if (chat.is_group) return chat.name?.toLowerCase().includes(q);
    const other = chat.members?.find((m) => m.user_id !== user?.id);
    return other?.user?.name?.toLowerCase().includes(q) || other?.user?.email?.toLowerCase().includes(q);
  });

  return (
    <aside className="w-72 flex-shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-100">Messages</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewChat}
            className="btn-ghost p-1.5"
            title="New conversation"
          >
            <svg className="w-4.5 h-4.5 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <ChatSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">
                {query ? 'No results found' : 'No conversations yet'}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {query ? 'Try a different search' : 'Start by creating a new chat'}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChat?.id === chat.id}
              currentUserId={user?.id}
              onClick={() => setActiveChat(chat)}
            />
          ))
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-slate-700/60 px-3 py-3 flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <Avatar name={user?.name} avatarUrl={user?.avatar_url} size="sm" />
          <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-slate-900 presence-online" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-200 truncate">{user?.name}</div>
          <div className="text-[10px] text-slate-500 truncate">{user?.email}</div>
        </div>
        <button
          onClick={logout}
          className="btn-ghost p-1.5 flex-shrink-0"
          title="Sign out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
