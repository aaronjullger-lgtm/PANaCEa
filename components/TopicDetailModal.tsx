
import React from 'react';
import type { TopicStats } from '../types';
import { ABBREVIATION_TO_TOPIC_MAP } from '../constants';
import { CloseIcon } from './icons/CloseIcon';

interface TopicDetailModalProps {
  topicStats: TopicStats;
  onClose: () => void;
  onStartSession: (topicAbbr: string) => void;
}

const TopicDetailModal: React.FC<TopicDetailModalProps> = ({ topicStats, onClose, onStartSession }) => {
  const { topic, score, correct, total } = topicStats;
  const fullTopicName = ABBREVIATION_TO_TOPIC_MAP[topic] || topic;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm relative animate-fade-in-down" 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"
          aria-label="Close modal"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-[#3D1B0E] mb-2">{fullTopicName}</h2>
        
        <div className="text-center my-6">
          <p className="text-5xl font-bold text-[#333333]">{score.toFixed(0)}%</p>
          <p className="text-slate-500 mt-1">
            Based on {total} questions ({correct} correct)
          </p>
        </div>

        <button
          onClick={() => onStartSession(topic)}
          className="w-full px-6 py-3 bg-[#3D1B0E] text-white text-lg font-bold rounded-lg hover:bg-[#2b130a] transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Start Session on {topic}
        </button>
      </div>
    </div>
  );
};

export default TopicDetailModal;
