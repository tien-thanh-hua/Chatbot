'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Paperclip, Mic } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

export default function ChatInput({
  onSendMessage,
  isLoading,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // Max height in pixels
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  return (
    <div className="border-t border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg">
      <div className="p-3 sm:p-4 lg:p-6">
        <form onSubmit={handleSubmit} className="relative">
          <div
            className={clsx(
              'relative flex items-end gap-3 p-3 rounded-2xl border-2 transition-all duration-200',
              isFocused
                ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-slate-800 shadow-lg'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            {/* Attachment button - hidden on very small screens */}
            <button
              type="button"
              aria-label="Attach file"
              className="hidden xs:flex flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled={isLoading}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                disabled={isLoading}
                className="w-full resize-none bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none text-sm leading-relaxed min-h-[24px] max-h-[120px]"
                rows={1}
              />
            </div>

            {/* Voice input button - hidden on very small screens */}
            <button
              type="button"
              aria-label="Voice input"
              className="hidden xs:flex flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled={isLoading}
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Send button */}
            <motion.button
              type="submit"
              disabled={!input.trim() || isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={clsx(
                'flex-shrink-0 p-2 rounded-xl transition-all duration-200',
                input.trim() && !isLoading
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </div>

          {/* Character count and tips */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {input.length > 0 && (
                <span className={input.length > 1000 ? 'text-amber-500' : ''}>
                  {input.length}/2000
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                Enter
              </kbd>{' '}
              to send •{' '}
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                Shift + Enter
              </kbd>{' '}
              for new line
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
