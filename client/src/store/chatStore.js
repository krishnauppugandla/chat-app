import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  chats: [],
  activeChat: null,
  typingUsers: {},
  onlineUsers: new Set(),

  setChats: (chats) => set({ chats }),

  setActiveChat: (chat) => set({ activeChat: chat }),

  updateChatLastMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats
        .map((c) =>
          c.id === chatId
            ? { ...c, last_message: message, updated_at: message.created_at }
            : c
        )
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)),
    })),

  incrementUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c
      ),
    })),

  clearUnread: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    })),

  addTypingUser: (chatId, userInfo) =>
    set((state) => {
      const current = state.typingUsers[chatId] || [];
      const exists = current.some((u) => u.userId === userInfo.userId);
      if (exists) return state;
      return {
        typingUsers: {
          ...state.typingUsers,
          [chatId]: [...current, userInfo],
        },
      };
    }),

  removeTypingUser: (chatId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [chatId]: (state.typingUsers[chatId] || []).filter((u) => u.userId !== userId),
      },
    })),

  setUserOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    }),

  prependChat: (chat) =>
    set((state) => {
      const exists = state.chats.find((c) => c.id === chat.id);
      if (exists) return state;
      return { chats: [chat, ...state.chats] };
    }),
}));

export default useChatStore;
