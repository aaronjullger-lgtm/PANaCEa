import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Trophy, Loader2, Copy, Check } from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';

// Types
interface StudyGroup {
  id: string;
  name: string;
  code: string;
  description?: string;
  memberCount: number;
  role: 'admin' | 'member';
}

interface LeaderboardEntry {
  id: string;
  score: number;
  rank: number;
  user: {
    firstName: string | null;
    lastName: string | null;
    school: string | null;
  };
}

export default function StudyGroupDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'groups' | 'leaderboard'>('groups');
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Form states
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const fetchGroups = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/social/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/social/leaderboard?period=weekly', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data?.entries || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/social/groups', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name: groupName, description: groupDesc })
      });
      
      if (!res.ok) throw new Error('Failed to create group');
      
      await fetchGroups();
      setShowCreateModal(false);
      setGroupName('');
      setGroupDesc('');
    } catch (err) {
      setError('Failed to create group. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/social/groups/join', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ code: joinCode })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join group');
      }
      
      await fetchGroups();
      setShowJoinModal(false);
      setJoinCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Social Learning
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Collaborate with peers and track your progress.
        </p>
      </header>

      <div className="flex space-x-4 mb-6 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('groups')}
          className={`pb-2 px-4 font-medium transition-colors ${
            activeTab === 'groups'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Study Groups
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`pb-2 px-4 font-medium transition-colors ${
            activeTab === 'leaderboard'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Leaderboard
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'groups' ? (
          <motion.div
            key="groups"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid gap-6 md:grid-cols-2 mb-8">
              {/* Create Group Card */}
              <div 
                onClick={() => setShowCreateModal(true)}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center min-h-[160px] cursor-pointer hover:border-blue-500 transition-colors group"
              >
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Create a Group</h3>
                <p className="text-sm text-slate-500">Start a new study circle</p>
              </div>

              {/* Join Group Card */}
              <div 
                onClick={() => setShowJoinModal(true)}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center min-h-[160px] cursor-pointer hover:border-emerald-500 transition-colors group"
              >
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Join a Group</h3>
                <p className="text-sm text-slate-500">Enter a code to join</p>
              </div>
            </div>

            {/* Groups List */}
            <h3 className="text-lg font-semibold mb-4">Your Groups</h3>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div>
            ) : groups.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                You haven't joined any groups yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {groups.map(group => (
                  <div key={group.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-lg">{group.name}</h4>
                      <p className="text-sm text-slate-500">{group.memberCount} members • {group.role === 'admin' ? 'Admin' : 'Member'}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-md">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{group.code}</span>
                      <Copy className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Global Rankings
                </h3>
                <select className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm px-2 py-1">
                  <option>This Week</option>
                  <option>All Time</option>
                </select>
              </div>
              
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No leaderboard data available yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {leaderboard.map((entry, index) => (
                    <div key={entry.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-amber-100 text-amber-800' :
                        'text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{entry.user.firstName} {entry.user.lastName?.charAt(0)}.</div>
                        <div className="text-xs text-slate-500">{entry.user.school || 'PA Student'}</div>
                      </div>
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {entry.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Create Study Group</h3>
            <form onSubmit={handleCreateGroup}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Group Name</label>
                <input 
                  type="text" 
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent"
                  placeholder="e.g. Class of 2025 Study Group"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea 
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent"
                  placeholder="What is this group for?"
                  rows={3}
                />
              </div>
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Join Study Group</h3>
            <form onSubmit={handleJoinGroup}>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-1">Group Code</label>
                <input 
                  type="text" 
                  required
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent font-mono uppercase"
                  placeholder="e.g. X7Y9Z2"
                />
              </div>
              {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
