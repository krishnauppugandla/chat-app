import { useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

const useTyping = (chatId) => {
  const { socket } = useSocket();
  const isTypingRef = useRef(false);
  const timerRef = useRef(null);

  const onType = useCallback(() => {
    if (!socket || !chatId) return;

    if (!isTypingRef.current) {
      socket.emit('typing_start', { chatId });
      isTypingRef.current = true;
    }

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      socket.emit('typing_stop', { chatId });
      isTypingRef.current = false;
    }, 1500);
  }, [socket, chatId]);

  const stopTyping = useCallback(() => {
    if (!socket || !chatId) return;
    clearTimeout(timerRef.current);
    if (isTypingRef.current) {
      socket.emit('typing_stop', { chatId });
      isTypingRef.current = false;
    }
  }, [socket, chatId]);

  return { onType, stopTyping };
};

export default useTyping;
