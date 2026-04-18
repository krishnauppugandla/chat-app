import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import useChatStore from '../store/chatStore.js';

const usePresence = (userId) => {
  const { socket } = useSocket();
  const { setUserOnline, setUserOffline, onlineUsers } = useChatStore();

  useEffect(() => {
    if (!socket) return;

    const handleOnline = ({ userId: uid }) => setUserOnline(uid);
    const handleOffline = ({ userId: uid }) => setUserOffline(uid);

    socket.on('user_online', handleOnline);
    socket.on('user_offline', handleOffline);

    return () => {
      socket.off('user_online', handleOnline);
      socket.off('user_offline', handleOffline);
    };
  }, [socket, setUserOnline, setUserOffline]);

  return onlineUsers.has(userId);
};

export default usePresence;
