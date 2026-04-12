import { useState, useRef, useEffect } from 'react';
import useTyping from '../hooks/useTyping.js';

const EMOJI_LIST = ['😀','😂','❤️','👍','🙏','🔥','🎉','😍','🤔','😎',
                    '👀','✅','🚀','💯','😢','🙌','😅','🤝','💪','👏'];

const EmojiPicker = ({ onSelect, onClose }) => {
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
      className="absolute bottom-full mb-2 left-0 bg-slate-800 border border-slate-600 rounded-2xl shadow-xl p-3 grid grid-cols-5 gap-1 w-52"
    >
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="text-xl hover:scale-125 transition-transform duration-100 leading-tight p-1 rounded"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

const ReplyPreview = ({ message, onCancel }) => (
  <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-700 bg-slate-800/50">
    <div className="flex-1 border-l-2 border-blue-500 pl-2">
      <div className="text-xs font-medium text-blue-400">{message.sender?.name}</div>
      <div className="text-xs text-slate-400 truncate">{message.content}</div>
    </div>
    <button
      onClick={onCancel}
      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);

const MessageInput = ({ chatId, onSend, replyingTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { onType, stopTyping } = useTyping(chatId);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [chatId]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleChange = (e) => {
    setText(e.target.value);
    autoResize();
    onType();
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !filePreview) return;

    onSend(trimmed, replyingTo?.id || null);
    setText('');
    setFilePreview(null);
    stopTyping();
    onCancelReply();

    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFilePreview({ file, url, type: file.type });
  };

  const handleEmojiSelect = (emoji) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.selectionStart = start + emoji.length;
      el.selectionEnd = start + emoji.length;
      el.focus();
      autoResize();
    }, 0);
  };

  const canSend = text.trim().length > 0 || filePreview !== null;

  return (
    <div className="border-t border-slate-700 bg-slate-900">
      {replyingTo && <ReplyPreview message={replyingTo} onCancel={onCancelReply} />}

      {filePreview && (
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-700 bg-slate-800/50">
          {filePreview.type.startsWith('image/') ? (
            <img src={filePreview.url} alt="preview" className="h-12 w-12 object-cover rounded-lg" />
          ) : (
            <div className="h-12 w-12 bg-slate-700 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <div className="flex-1 text-sm text-slate-300 truncate">{filePreview.file.name}</div>
          <button
            onClick={() => setFilePreview(null)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-3">
        <div className="relative">
          <button
            className="btn-ghost"
            onClick={() => setShowEmoji((v) => !v)}
            title="Emoji"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {showEmoji && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />}
        </div>

        <button
          className="btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          rows={1}
          className="flex-1 bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed transition-all duration-150 max-h-30"
          style={{ height: 'auto' }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="btn-primary p-2.5 rounded-xl disabled:opacity-40 flex-shrink-0"
          title="Send"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
