import { useState, useEffect, useCallback, useRef } from 'react';
import { messageApi } from '../api/message.api.js';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const useMessages = (chatId) => {
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { socket } = useSocket();
  const { user } = useAuth();
  const chatIdRef = useRef(chatId);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const fetchInitial = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);

    try {
      const { data } = await messageApi.getMessages(chatId);
      setMessages(data.messages);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Error shown in UI via empty state
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Register socket listeners for the active chat
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleNewMessage = (message) => {
      if (message.chat_id !== chatId) return;

      setMessages((prev) => {
        // Replace optimistic placeholder if tempId matches
        if (message.tempId) {
          const hasOptimistic = prev.some((m) => m.id === message.tempId);
          if (hasOptimistic) {
            return prev.map((m) => (m.id === message.tempId ? message : m));
          }
        }
        // Deduplicate by id in case of concurrent updates
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    };

    const handleEdited = ({ messageId, content, edited_at }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content, is_edited: true, edited_at } : m
        )
      );
    };

    const handleDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_deleted: true } : m))
      );
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    const handleSeenBy = ({ messageId, userId }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const existingStatuses = m.statuses || [];
          const alreadyMarked = existingStatuses.some((s) => s.user_id === userId);
          if (alreadyMarked) return m;
          return {
            ...m,
            statuses: [...existingStatuses, { user_id: userId, status: 'seen' }],
          };
        })
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleEdited);
    socket.on('message_deleted', handleDeleted);
    socket.on('reaction_updated', handleReactionUpdated);
    socket.on('seen_by', handleSeenBy);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleEdited);
      socket.off('message_deleted', handleDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('seen_by', handleSeenBy);
    };
  }, [socket, chatId]);

  const sendMessage = useCallback(
    (content, replyToId = null) => {
      if (!socket || !chatId || !content?.trim()) return;

      const tempId = `temp-${Date.now()}`;

      const optimistic = {
        id: tempId,
        chat_id: chatId,
        sender_id: user.id,
        sender: { id: user.id, name: user.name, avatar_url: user.avatar_url },
        content: content.trim(),
        type: 'text',
        reply_to_id: replyToId,
        reply_to: null,
        is_edited: false,
        is_deleted: false,
        reactions: [],
        statuses: [],
        created_at: new Date().toISOString(),
        _sending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      socket.emit('send_message', { chatId, content: content.trim(), replyToId, tempId });
    },
    [socket, chatId, user]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) return;

    setLoadingMore(true);
    try {
      const { data } = await messageApi.getMessages(chatId, nextCursor);
      setMessages((prev) => [...data.messages, ...prev]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Silently fail — user can scroll to trigger retry
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, nextCursor, hasMore, loadingMore]);

  return { messages, loading, loadingMore, hasMore, sendMessage, loadMore };
};

export default useMessages;
