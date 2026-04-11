import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import Avatar from './Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const REACTION_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

const CheckIcon = ({ status }) => {
  if (status === 'seen') {
    return (
      <span className="text-blue-400 text-xs leading-none">✓✓</span>
    );
  }
  if (status === 'delivered') {
    return <span className="text-slate-400 text-xs leading-none">✓✓</span>;
  }
  return <span className="text-slate-500 text-xs leading-none">✓</span>;
};

const ReactionPicker = ({ onReact, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 bottom-full mb-1 bg-slate-800 border border-slate-600 rounded-2xl shadow-xl px-2 py-1.5 flex gap-1"
    >
      {REACTION_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onReact(emoji); onClose(); }}
          className="text-lg hover:scale-125 transition-transform duration-100 leading-none"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

const ContextMenu = ({ isOwn, onReply, onEdit, onDelete, onClose, position }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ top: position.y, left: position.x }}
    >
      <button className="context-menu-item" onClick={() => { onReply(); onClose(); }}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Reply
      </button>
      {isOwn && (
        <>
          <button className="context-menu-item" onClick={() => { onEdit(); onClose(); }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            className="context-menu-item text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            onClick={() => { onDelete(); onClose(); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </>
      )}
    </div>
  );
};

const MessageBubble = ({ message, isOwn, showAvatar, isGroup, onReply, onEdit }) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleReact = (emoji) => {
    if (!socket) return;
    socket.emit('react', { messageId: message.id, emoji, chatId: message.chat_id });
  };

  const handleDelete = () => {
    if (!socket) return;
    socket.emit('delete_message', { messageId: message.id, chatId: message.chat_id });
  };

  const groupedReactions = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || { emoji: r.emoji, count: 0, users: [] };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.user);
    return acc;
  }, {});

  const myStatus = isOwn
    ? (() => {
        const statuses = message.statuses || [];
        if (statuses.some((s) => s.status === 'seen')) return 'seen';
        if (statuses.some((s) => s.status === 'delivered')) return 'delivered';
        return message._sending ? 'sending' : 'sent';
      })()
    : null;

  if (message.is_deleted) {
    return (
      <div className={`flex items-end gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        {showAvatar && !isOwn ? (
          <Avatar name={message.sender?.name} avatarUrl={message.sender?.avatar_url} size="sm" />
        ) : (
          <div className="w-7" />
        )}
        <div className={`px-4 py-2 rounded-2xl text-sm italic text-slate-500 border border-slate-700 ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-end gap-2 mb-0.5 message-appear ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      onContextMenu={handleContextMenu}
    >
      {!isOwn && (
        showAvatar ? (
          <Avatar name={message.sender?.name} avatarUrl={message.sender?.avatar_url} size="sm" className="mb-1" />
        ) : (
          <div className="w-7 flex-shrink-0" />
        )
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} relative max-w-xs lg:max-w-md xl:max-w-lg`}>
        {isGroup && !isOwn && showAvatar && (
          <span className="text-xs font-medium text-slate-400 mb-1 ml-1">
            {message.sender?.name}
          </span>
        )}

        {message.reply_to && (
          <div className={`px-3 py-1.5 mb-1 rounded-xl text-xs border-l-2 border-blue-500 bg-slate-800/80 max-w-full ${isOwn ? 'border-slate-500' : 'border-blue-500'}`}>
            <div className="font-medium text-blue-400 truncate">{message.reply_to.sender?.name}</div>
            <div className="text-slate-400 truncate">{message.reply_to.content}</div>
          </div>
        )}

        <div className="relative">
          <div
            className={`relative cursor-pointer ${isOwn ? 'message-bubble-own' : 'message-bubble-other'}`}
            onMouseEnter={() => setShowReactionPicker(false)}
          >
            {message.type === 'image' && message.file_url ? (
              <img
                src={message.file_url}
                alt="attachment"
                className="rounded-xl max-w-full max-h-64 object-cover"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            )}

            <div
              className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
              onMouseEnter={() => setShowTimestamp(true)}
              onMouseLeave={() => setShowTimestamp(false)}
            >
              <span className={`text-[10px] transition-opacity duration-200 ${showTimestamp ? 'opacity-100' : 'opacity-50'} ${isOwn ? 'text-blue-200' : 'text-slate-500'}`}>
                {format(new Date(message.created_at), 'HH:mm')}
              </span>
              {message.is_edited && (
                <span className={`text-[10px] ${isOwn ? 'text-blue-200' : 'text-slate-500'}`}>(edited)</span>
              )}
              {isOwn && <CheckIcon status={myStatus} />}
            </div>
          </div>

          {/* Hover reaction trigger */}
          <button
            className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 rounded-full p-0.5 text-xs"
            onClick={() => setShowReactionPicker(true)}
          >
            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {showReactionPicker && (
            <ReactionPicker onReact={handleReact} onClose={() => setShowReactionPicker(false)} />
          )}
        </div>

        {Object.values(groupedReactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.values(groupedReactions).map(({ emoji, count, users }) => {
              const iReacted = users.some((u) => u.id === user?.id);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    iReacted
                      ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                      : 'bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-600/60'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          isOwn={isOwn}
          position={contextMenu}
          onReply={() => onReply(message)}
          onEdit={() => onEdit(message)}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default MessageBubble;
