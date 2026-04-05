import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import NewChatModal from '../components/NewChatModal.jsx';
import useChatStore from '../store/chatStore.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { chatApi } from '../api/chat.api.js';

const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-slate-900 select-none">
    <div className="relative">
      <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center">
        <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </div>
    <div className="text-center">
      <h3 className="text-base font-semibold text-slate-300">Select a conversation</h3>
      <p className="text-sm text-slate-600 mt-1">Choose from the sidebar or start a new chat</p>
    </div>
  </div>
);

const Chat = () => {
  const { user, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const { chats, setChats, activeChat, setActiveChat, setUserOnline, setUserOffline, incrementUnread } = useChatStore();
  const [showNewChat, setShowNewChat] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(true);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  // Load chat list on mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        const { data } = await chatApi.getChats();
        setChats(data);

        // Restore last active chat from localStorage
        const savedChatId = localStorage.getItem('activeChat');
        if (savedChatId) {
          const saved = data.find((c) => c.id === savedChatId);
          if (saved) setActiveChat(saved);
        }
      } catch {
        // Error handled silently — sidebar shows empty state
      } finally {
        setChatsLoading(false);
      }
    };

    if (user) loadChats();
  }, [user, setChats, setActiveChat]);

  // Persist active chat selection
  useEffect(() => {
    if (activeChat) {
      localStorage.setItem('activeChat', activeChat.id);
    }
  }, [activeChat]);

  // Global socket listeners for presence and new messages in non-active chats
  useEffect(() => {
    if (!socket) return;

    const handleUserOnline = ({ userId }) => setUserOnline(userId);
    const handleUserOffline = ({ userId }) => setUserOffline(userId);

    const handleNewMessage = (message) => {
      if (activeChat?.id !== message.chat_id) {
        incrementUnread(message.chat_id);
      }
    };

    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChat, setUserOnline, setUserOffline, incrementUnread]);

  if (authLoading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-950">
      <Sidebar
        onNewChat={() => setShowNewChat(true)}
        loading={chatsLoading}
      />

      {activeChat ? (
        <ChatWindow key={activeChat.id} chat={activeChat} />
      ) : (
        <EmptyState />
      )}

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={(chat) => {
            setActiveChat(chat);
            setShowNewChat(false);
          }}
        />
      )}
    </div>
  );
};

export default Chat;
