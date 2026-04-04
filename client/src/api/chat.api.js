import api from './axios.js';

export const chatApi = {
  getChats: () => api.get('/chats'),
  createChat: (data) => api.post('/chats', data),
  searchUsers: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
};
