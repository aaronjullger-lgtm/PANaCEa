
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X, Check, ArrowRight, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';

interface StudyRecommendation {
    id: string;
    type: string;
    topic: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    data: any;
}

interface RecommendationFeedProps {
    onNavigateToDrill: (mode: string, settings?: any) => void;
    className?: string;
}

export const RecommendationFeed: React.FC<RecommendationFeedProps> = ({ onNavigateToDrill, className }) => {
    const { getToken } = useAuth();
    const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const fetchRecommendations = async () => {
        try {
            const token = await getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            const res = await fetch('/api/recommendations', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                const data = await res.json();
                setRecommendations(data);
            }
        } catch (e) {
            console.error("Failed to fetch recommendations", e);
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendations = async () => {
        setGenerating(true);
        try {
            const token = await getToken();
            if (!token) {
                toast.error("Authentication required");
                setGenerating(false);
                return;
            }

            const res = await fetch('/api/recommendations/generate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    toast.success(`Found ${data.length} new recommendations!`);
                    fetchRecommendations();
                } else if (recommendations.length === 0) {
                    toast.info("You're all caught up! No new recommendations.");
                }
            } else {
                toast.error("Failed to generate recommendations");
            }
        } catch (e) {
            toast.error("Failed to analyze progress");
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
        // Auto-generate on mount if empty to keep it fresh.
        generateRecommendations();
    }, [getToken]);

    const handleAction = async (id: string, action: 'complete' | 'dismiss') => {
        // Optimistic update
        setRecommendations(prev => prev.filter(r => r.id !== id));

        try {
            const token = await getToken();
            if (!token) {
                toast.error("Authentication required");
                fetchRecommendations(); // Revert
                return;
            }

            // Use the action endpoint with body containing recommendationId and action
            const res = await fetch('/api/recommendations/action', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recommendationId: id, action }),
            });

            if (!res.ok) {
                throw new Error('Failed to update recommendation');
            }

            if (action === 'complete') {
                toast.success("Marked as complete!");
            }
        } catch (e) {
            toast.error("Failed to update status");
            fetchRecommendations(); // Revert
        }
    };

    const handleStart = (rec: StudyRecommendation) => {
        if (rec.type === 'review') {
            // Navigate to review session for this topic
            // Assuming 'custom_practice' or similar can take topic/conditionId
            onNavigateToDrill('custom_practice', {
                conditionId: rec.data?.conditionId,
                mode: 'tutor'
            });
        } else if (rec.type === 'drill_session') {
            onNavigateToDrill('core_adaptive', { focus: 'due' });
        }

        // Auto-complete or just leave pending? 
        // Usually user clicks start, we don't know if they finish.
        // Leaving pending is safer. They can mark "Done" in feed or we track it later.
        // Let's dismiss it from feed so it doesn't clutter? No, keep it until action.
    };

    if (loading) return null; // Or skeleton

    // Only show if we have items or strict requirement?
    // If empty and not generating, maybe return null.
    if (recommendations.length === 0 && !generating) return null;

    return (
        <div className={`mb-8 ${className}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Smart Recommendations
                </h3>
                <button
                    onClick={generateRecommendations}
                    disabled={generating}
                    className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
                    title="Refresh Analysis"
                >
                    <RefreshCw className={`w-4 h-4 text-[var(--color-text-muted)] ${generating ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                    {recommendations.map(rec => (
                        <motion.div
                            key={rec.id}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative p-5 rounded-2xl bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-sm group hover:shadow-md transition-shadow"
                        >
                            {/* Priority Indicator */}
                            {rec.priority === 'high' && (
                                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}

                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                    <Lightbulb className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-[var(--color-text-primary)] line-clamp-1">{rec.topic}</h4>
                                    <p className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{rec.reason}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <button
                                    onClick={() => handleStart(rec)}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] font-semibold text-sm hover:opacity-90 transition-opacity"
                                >
                                    Start
                                    <ArrowRight className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => handleAction(rec.id, 'dismiss')}
                                    className="p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                                    title="Dismiss"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => handleAction(rec.id, 'complete')}
                                    className="p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30 transition-colors"
                                    title="Mark as Done"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {generating && recommendations.length === 0 && (
                    <div className="col-span-full py-8 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                        <p>Analyzing your learning profile...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
