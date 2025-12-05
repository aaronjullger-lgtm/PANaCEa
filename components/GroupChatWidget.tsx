// components/GroupChatWidget.tsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  generateContextualConversation, 
  generateAIConversation,
  getTimeBasedMotivation,
  type ChatMessage 
} from '../services/conversationService';

interface GroupChatWidgetProps {
  userStats: {
    currentStreak: number;
    recentTopic?: string;
    questionsToday: number;
    weakAreas?: string[];
  };
  isVisible?: boolean;
}

// Threshold for using AI vs template-based generation
const AI_USAGE_THRESHOLD = 0.3; // 70% chance to use AI when enabled

const GroupChatWidget: React.FC<GroupChatWidgetProps> = ({ 
  userStats, 
  isVisible = true 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [useAI, setUseAI] = useState(false);

  // Generate initial conversation
  useEffect(() => {
    if (isVisible) {
      loadConversation();
    }
  }, [isVisible, userStats.currentStreak]);

  const loadConversation = async () => {
    setIsLoading(true);
    try {
      let newMessages: ChatMessage[];
      
      if (useAI && Math.random() > AI_USAGE_THRESHOLD) {
        const hour = new Date().getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
        
        newMessages = await generateAIConversation({
          userActivity: userStats.questionsToday > 0 
            ? `completed ${userStats.questionsToday} questions today`
            : 'logged in to study',
          recentTopics: userStats.weakAreas || ['cardiology', 'pharmacology'],
          timeOfDay
        });
      } else {
        // Use template-based generation
        newMessages = await generateContextualConversation(userStats);
      }
      
      setMessages(newMessages);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMoodColor = (mood: ChatMessage['mood']) => {
    switch (mood) {
      case 'celebrating':
        return 'text-amber-500 dark:text-amber-400';
      case 'encouraging':
        return 'text-green-500 dark:text-green-400';
      case 'excited':
        return 'text-blue-500 dark:text-blue-400';
      case 'curious':
        return 'text-purple-500 dark:text-purple-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="card-premium-glass card-noise-texture rounded-2xl overflow-hidden shadow-lg border border-[var(--color-border)]">
        {/* Header */}
        <div 
          className="p-4 border-b border-[var(--color-border)] bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <MessageSquare className="w-6 h-6 text-blue-500" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Study Group Chat
                  <Sparkles className="w-4 h-4 text-amber-500" />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {messages.length} active members online
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </motion.button>
          </div>
        </div>

        {/* Collapsed Preview */}
        {!isExpanded && messages.length > 0 && (
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">
                {messages[messages.length - 1].avatar}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {messages[messages.length - 1].author}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                  {messages[messages.length - 1].message}
                </p>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">
                {formatTimeAgo(messages[messages.length - 1].timestamp)}
              </span>
            </div>
          </div>
        )}

        {/* Expanded Messages */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : (
                  <>
                    {/* Time-based motivation banner */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl p-3 border border-blue-200/20 dark:border-blue-700/20">
                      <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                        {getTimeBasedMotivation()}
                      </p>
                    </div>

                    {/* Messages */}
                    <AnimatePresence>
                      {messages.map((msg, index) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-3 group"
                        >
                          <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                            {msg.avatar}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <p className={`text-sm font-semibold ${getMoodColor(msg.mood)}`}>
                                {msg.author}
                              </p>
                              <span className="text-xs text-slate-400">
                                {formatTimeAgo(msg.timestamp)}
                              </span>
                            </div>
                            <motion.div
                              initial={{ opacity: 0.8 }}
                              whileHover={{ opacity: 1 }}
                              className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-slate-200/50 dark:border-slate-700/50"
                            >
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                {msg.message}
                              </p>
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Refresh button */}
                    <div className="pt-2 flex justify-center">
                      <motion.button
                        onClick={loadConversation}
                        disabled={isLoading}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate New Messages
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default GroupChatWidget;
