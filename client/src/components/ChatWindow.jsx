import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import MessageBubble from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import Avatar from './Avatar.jsx';
import PresenceDot from './PresenceDot.jsx';
import useMessages from '../hooks/useMessages.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { messageApi } from '../api/message.api.js';
import useChatStore from '../store/chatStore.js';

const DateDivider = ({ date }) => {
  let label;
  if (isToday(new Date(date))) label = 'Today';
  else if (isYesterday(new Date(date))) label = 'Yesterday';
  else label = format(new Date(date), 'MMMM d, yyyy');

  return (
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-slate-700/60" />
      <span className="text-[11px] text-slate-500 font-medium px-2">{label}</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  );
};

const MessageSkeleton = ({ isOwn }) => (
  <div className={`flex items-end gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
    <div className="w-7 h-7 rounded-full skeleton-bar flex-shrink-0" />
    <div className={`space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
      <div className={`h-9 skeleton-bar rounded-2xl ${isOwn ? 'w-48' : 'w-56'}`} />
      <div className="h-2.5 w-10 skeleton-bar rounded" />
    </div>
  </div>
);

const ChatWindow = ({ chat }) => {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { updateChatLastMessage, clearUnread, addTypingUser, removeTypingUser } = useChatStore();

  const { messages, loading, loadingMore, hasMore, sendMessage, loadMore } = useMessages(chat.id);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const wasAtBottomRef = useRef(true);

  const otherMember = !chat.is_group
    ? chat.members?.find((m) => m.user_id !== user?.id)
    : null;

  const displayName = chat.is_group
    ? chat.name
    : otherMember?.user?.name || 'Unknown';

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);

  // Check if user is near bottom before new messages arrive
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      loadMore();
    }
  };

  // Auto-scroll on new messages only when already at bottom
  useEffect(() => {
    if (wasAtBottomRef.current) {
      scrollToBottom(messages.length > 1);
    }
  }, [messages, scrollToBottom]);

  // Jump to bottom on chat switch
  useEffect(() => {
    scrollToBottom(false);
    clearUnread(chat.id);
  }, [chat.id, clearUnread, scrollToBottom]);

  // Track last message for sidebar updates
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) updateChatLastMessage(chat.id, last);
  }, [messages, chat.id, updateChatLastMessage]);

  // Mark most recent message as seen
  useEffect(() => {
    if (!socket || messages.length === 0) return;
    const lastFromOther = [...messages]
      .reverse()
      .find((m) => m.sender_id !== user?.id && !m._sending);
    if (lastFromOther) {
      socket.emit('mark_seen', { chatId: chat.id, messageId: lastFromOther.id });
    }
  }, [messages, socket, chat.id, user?.id]);

  // Update document title with unread badge
  useEffect(() => {
    const unreadTotal = useChatStore.getState().chats.reduce(
      (sum, c) => sum + (c.unread_count || 0), 0
    );
    document.title = unreadTotal > 0 ? `(${unreadTotal}) ChatApp` : 'ChatApp';
    return () => { document.title = 'ChatApp'; };
  }, [messages]);

  // Socket events for typing
  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ userId, chatId, name }) => {
      if (chatId === chat.id && userId !== user?.id) {
        addTypingUser(chat.id, { userId, name });
      }
    };

    const handleStopTyping = ({ userId, chatId }) => {
      if (chatId === chat.id) removeTypingUser(chat.id, userId);
    };

    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);
    return () => {
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [socket, chat.id, user?.id, addTypingUser, removeTypingUser]);

  // Message search with debounce
  useEffect(() => {
    if (!searchQuery.trim() || !searchOpen) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await messageApi.searchMessages(chat.id, searchQuery);
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen, chat.id]);

  const handleSend = (content, replyToId) => {
    sendMessage(content, replyToId);
    setReplyingTo(null);
  };

  const handleEditSubmit = async () => {
    if (!editingMessage || !editContent.trim()) return;
    try {
      socket.emit('edit_message', {
        messageId: editingMessage.id,
        content: editContent.trim(),
        chatId: chat.id,
      });
    } catch {
      // handled by socket error event
    }
    setEditingMessage(null);
    setEditContent('');
  };

  // Render messages with date dividers and grouped avatars
  const renderMessages = () => {
    const items = [];
    let prevDate = null;
    let prevSenderId = null;

    messages.forEach((msg, idx) => {
      const msgDate = new Date(msg.created_at);
      const isSameDate = prevDate && isSameDay(msgDate, prevDate);

      if (!isSameDate) {
        items.push(<DateDivider key={`date-${msg.id}`} date={msg.created_at} />);
      }

      const isOwn = msg.sender_id === user?.id;
      const isSameSender = prevSenderId === msg.sender_id;
      const showAvatar = !isSameSender;

      items.push(
        <MessageBubble
          key={msg.id}
          message={msg}
          isOwn={isOwn}
          showAvatar={showAvatar}
          isGroup={chat.is_group}
          onReply={setReplyingTo}
          onEdit={(m) => { setEditingMessage(m); setEditContent(m.content); }}
        />
      );

      prevDate = msgDate;
      prevSenderId = msg.sender_id;
    });

    return items;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/60 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Avatar
              name={displayName}
              avatarUrl={chat.is_group ? chat.avatar_url : otherMember?.user?.avatar_url}
              size="md"
            />
            {!chat.is_group && otherMember && (
              <PresenceDot userId={otherMember.user_id} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">{displayName}</h2>
            <p className="text-xs text-slate-500">
              {chat.is_group
                ? `${chat.members?.length || 0} members`
                : connected
                ? 'Online'
                : 'Offline'}
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSearchOpen((v) => !v); setSearchQuery(''); setSearchResults([]); }}
          className={`btn-ghost ${searchOpen ? 'text-blue-400 bg-blue-600/10' : ''}`}
          title="Search messages"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Disconnected banner */}
      {!connected && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-400 text-xs font-medium">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Reconnecting...
        </div>
      )}

      {/* Search bar */}
      {searchOpen && (
        <div className="px-4 py-2.5 border-b border-slate-700/60 bg-slate-900 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this conversation..."
              autoFocus
              className="input-field pl-8 text-sm py-2"
            />
          </div>

          {searchQuery && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searching ? (
                <div className="text-xs text-slate-500 py-2 px-1">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((msg) => (
                  <div key={msg.id} className="px-2 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
                    <div className="text-xs text-slate-400 mb-0.5">{msg.sender?.name}</div>
                    <div className="text-sm text-slate-200 truncate">{msg.content}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{format(new Date(msg.created_at), 'MMM d, HH:mm')}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-2 px-1">No messages found</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {loading ? (
          <div className="space-y-1 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <MessageSkeleton key={i} isOwn={i % 3 === 0} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400">Start the conversation</p>
              <p className="text-xs text-slate-600 mt-1">Send a message to {displayName}</p>
            </div>
          </div>
        ) : (
          <>
            {loadingMore && (
              <div className="text-center py-3">
                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading older messages
                </div>
              </div>
            )}
            {renderMessages()}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <TypingIndicator chatId={chat.id} />

      {/* Edit mode overlay */}
      {editingMessage && (
        <div className="px-4 py-2 border-t border-slate-700 bg-slate-800/80 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-blue-400 mb-1 font-medium">Editing message</div>
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit();
                if (e.key === 'Escape') { setEditingMessage(null); setEditContent(''); }
              }}
              autoFocus
              className="input-field text-sm py-1.5"
            />
          </div>
          <button onClick={handleEditSubmit} className="btn-primary py-1.5 px-3 text-sm">Save</button>
          <button
            onClick={() => { setEditingMessage(null); setEditContent(''); }}
            className="btn-ghost py-1.5 px-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      <MessageInput
        chatId={chat.id}
        onSend={handleSend}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};

export default ChatWindow;
