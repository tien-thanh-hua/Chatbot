'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import ChatContainer from '@/app/components/ChatContainer';
import ChatInput from '@/app/components/ChatInput';

export default function Home() {
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      text: string;
      sender: 'user' | 'bot';
      timestamp?: Date;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      text: message,
      sender: 'user' as const,
      timestamp: new Date(),
    };

    // Update messages state and capture the current history
    const currentHistory = [...messages, userMessage];
    setMessages(currentHistory);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: messages, // Send the history before the current message
        }),
      });

      if (!res.body) {
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      const botMessageId = (Date.now() + 1).toString();

      // Add a placeholder for the bot message
      setMessages((prev) => [
        ...prev,
        { id: botMessageId, text: '', sender: 'bot', timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        fullResponse += decoder.decode(value, { stream: true });
        // Update the bot message in the UI as chunks come in
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMessageId ? { ...msg, text: fullResponse } : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="h-screen flex flex-col max-w-6xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm"
        >
          <div className="flex items-center justify-between p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  AI Assistant
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 hidden xs:block">
                  Your intelligent conversation partner
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Online
            </div>
          </div>
        </motion.header>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <ChatContainer messages={messages} isLoading={isLoading} />
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
