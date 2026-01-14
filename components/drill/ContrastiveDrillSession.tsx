
import React, { useState } from 'react';
import { DrillLandingPage } from './DrillLandingPage';
import { ContrastiveDrill } from './ContrastiveDrill';
import { Target, ArrowRight } from 'lucide-react';
import DrillShell from './DrillShell';

// Mock data or fetch from API in real usage
const DEMO_SET = {
    id: "chest-pain-1",
    symptom: "Chest Pain",
    conditions: ["Acute MI", "Aortic Dissection", "Pulmonary Embolism", "Pericarditis", "GERD"],
    difficulty: "medium"
};

export function ContrastiveDrillSession({ onExit }: { onExit: () => void }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [drillId, setDrillId] = useState<string | null>(null);

    const handleStart = async () => {
        // In a real app we would create the drill attempt via API here
        // const res = await fetch('/api/drills/contrastive/start', ...);
        // setDrillId(res.drillId);

        setDrillId("demo-drill-id"); // Mock
        setIsPlaying(true);
    };

    const handleComplete = (stats: any) => {
        console.log("Drill complete", stats);
        // Show summary or redirect
    };

    if (isPlaying && drillId) {
        return (
            <DrillShell
                title="Contrastive Drill: Chest Pain"
                breadcrumb={['Drills', 'Contrastive', 'Chest Pain']}
                onBackToHub={onExit}
                onBack={() => setIsPlaying(false)}
            >
                <ContrastiveDrill
                    set={DEMO_SET}
                    drillId={drillId}
                    onComplete={handleComplete}
                />
            </DrillShell>
        );
    }

    return (
        <DrillShell
            title="Contrastive Learning"
            breadcrumb={['Drills', 'Contrastive']}
            onBackToHub={onExit}
            hideBreadcrumb
        >
            <DrillLandingPage
                title="Contrastive Pattern Recognition"
                description="Master the subtle differences between similar conditions."
                longDescription="In this high-yield mode, you'll be presented with clinical vignettes that could plausibly be one of several related conditions. Your job is to identify the key distinguishing features that rule in one diagnosis and rule out the others."
                icon={Target}
                accentColor="deep-plum"
                estimatedMinutes={5}
                objectives={[
                    "Differentiate between similar clinical presentations",
                    "Identify pathognomonic details",
                    "Build illness scripts for common symptoms"
                ]}
                instructions={[
                    "Review the clinical vignette carefully.",
                    "Compare against the 5 possible conditions sharing the symptom.",
                    "Select the most likely diagnosis based on key discriminators.",
                    "Review the comparison table to reinforce your learning."
                ]}
                onStart={handleStart}
                onExit={onExit}
            />
        </DrillShell>
    );
}
