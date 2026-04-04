import api from './axios.js';

export const messageApi = {
  getMessages: (chatId, cursor) => {
    const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return api.get(`/messages/${chatId}${params}`);
  },
  sendMessage: (chatId, data) => api.post(`/messages/${chatId}`, data),
  editMessage: (messageId, content) => api.patch(`/messages/${messageId}`, { content }),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
  reactToMessage: (messageId, emoji) => api.post(`/messages/${messageId}/react`, { emoji }),
  searchMessages: (chatId, q) => api.get(`/messages/${chatId}/search?q=${encodeURIComponent(q)}`),
};
