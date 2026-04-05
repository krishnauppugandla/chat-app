import { useState, useEffect, useCallback } from 'react';
import { chatApi } from '../api/chat.api.js';
import Avatar from './Avatar.jsx';
import useChatStore from '../store/chatStore.js';

const SearchResult = ({ user, selected, onToggle }) => (
  <button
    onClick={() => onToggle(user)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
      selected ? 'bg-blue-600/20 border border-blue-500/40' : 'hover:bg-slate-700'
    }`}
  >
    <Avatar name={user.name} avatarUrl={user.avatar_url} size="md" />
    <div className="flex-1 text-left min-w-0">
      <div className="text-sm font-medium text-slate-100 truncate">{user.name}</div>
      <div className="text-xs text-slate-500 truncate">{user.email}</div>
    </div>
    {selected && (
      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

const NewChatModal = ({ onClose, onChatCreated }) => {
  const [tab, setTab] = useState('direct');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { prependChat, setActiveChat } = useChatStore();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await chatApi.searchUsers(query);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const toggleUser = (user) => {
    if (tab === 'direct') {
      setSelectedUsers([user]);
    } else {
      setSelectedUsers((prev) =>
        prev.some((u) => u.id === user.id)
          ? prev.filter((u) => u.id !== user.id)
          : [...prev, user]
      );
    }
  };

  const handleCreate = async () => {
    setError('');
    if (selectedUsers.length === 0) {
      setError('Please select at least one person');
      return;
    }

    if (tab === 'group' && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    setCreating(true);
    try {
      let chat;
      if (tab === 'direct') {
        const { data } = await chatApi.createChat({ userId: selectedUsers[0].id });
        chat = data;
      } else {
        const { data } = await chatApi.createChat({
          name: groupName.trim(),
          memberIds: selectedUsers.map((u) => u.id),
          is_group: true,
        });
        chat = data;
      }
      prependChat(chat);
      setActiveChat(chat);
      onChatCreated(chat);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-700">
          <h2 className="text-base font-semibold text-slate-100">New Conversation</h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-4">
          {['direct', 'group'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedUsers([]); setQuery(''); setResults([]); }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {t === 'direct' ? 'Direct Message' : 'Group Chat'}
            </button>
          ))}
        </div>

        <div className="px-5 pt-4 pb-2 space-y-3">
          {tab === 'group' && (
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input-field text-sm"
              autoFocus
            />
          )}

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field pl-9 text-sm"
              autoFocus={tab === 'direct'}
            />
          </div>

          {selectedUsers.length > 0 && tab === 'group' && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span key={u.id} className="flex items-center gap-1 bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs px-2 py-1 rounded-full">
                  {u.name}
                  <button onClick={() => toggleUser(u)} className="hover:text-white">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 max-h-56 overflow-y-auto space-y-0.5 pb-2">
          {searching ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-9 h-9 rounded-full skeleton-bar" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 skeleton-bar rounded" />
                    <div className="h-2.5 w-32 skeleton-bar rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            results.map((u) => (
              <SearchResult
                key={u.id}
                user={u}
                selected={selectedUsers.some((s) => s.id === u.id)}
                onToggle={toggleUser}
              />
            ))
          ) : query.trim() && !searching ? (
            <div className="text-center py-6 text-slate-500 text-sm">No users found</div>
          ) : null}
        </div>

        {error && (
          <div className="mx-5 mb-3 px-3 py-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="px-5 pb-5 pt-2">
          <button
            onClick={handleCreate}
            disabled={creating || selectedUsers.length === 0}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              `Start ${tab === 'direct' ? 'Conversation' : 'Group Chat'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;
