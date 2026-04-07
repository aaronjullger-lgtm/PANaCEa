function calculateGrade(metric) {
  const config = {
    minValidTime: 1000,
    maxValidTime: 180000,
    switchPenalty: 0.3,
    ratingThresholds: { easy: 0.5, good: 0.85, hard: 1.3 }
  };
  const parTime = metric.parTimeMs ?? 30000;
  const effectiveLatency = metric.timeToFirstClick * (1 + metric.answerSwitches * config.switchPenalty);
  const latencyRatio = effectiveLatency / parTime;
  const base = metric.isCorrect ? 3.0 : 1.0;
  let grade = base;
  if (metric.isCorrect) {
    const penaltySwitch = metric.answerSwitches * 0.15;
    const latencyExcess = Math.max(0, Math.min(2, latencyRatio - 0.85));
    const penaltyLatency = latencyExcess * 0.3;
    const commitmentGapSec = (metric.commitmentGapMs ?? 0) / 1000;
    const penaltyCommitment = commitmentGapSec * 0.02;
    const entropy = metric.cursorEntropy ?? 0;
    const penaltyEntropy = entropy > 1 ? (entropy - 1) * 0.2 : 0;
    const penaltyOscillation = (metric.hoverOscillationCount ?? 0) * 0.1;
    const bonusFast = latencyRatio < 0.5 ? 0.3 : latencyRatio < 0.7 ? 0.15 : 0;
    grade = base - penaltySwitch - penaltyLatency - penaltyCommitment - penaltyEntropy - penaltyOscillation + bonusFast;
  }
  grade = Math.max(1.0, Math.min(4.0, grade));
  return grade;
}

function gradeToRating(grade) {
  if (grade < 2.0) return 1; // Again
  return 3; // Good (binary system — Hard/Easy deprecated)
}

// brute force some combos
const parTime = 30000;
for (let time = 10000; time <= 60000; time += 5000) {
  for (let switches = 0; switches <= 3; switches++) {
    for (let gap = 0; gap <= 5000; gap += 1000) {
      for (let entropy = 1; entropy <= 3; entropy += 0.5) {
        for (let osc = 0; osc <= 2; osc++) {
          const metric = {
            timeToFirstClick: time,
            answerSwitches: switches,
            commitmentGapMs: gap,
            cursorEntropy: entropy,
            hoverOscillationCount: osc,
            totalDwellTime: 20000,
            isCorrect: true,
            parTimeMs: parTime,
          };
          const grade = calculateGrade(metric);
          const rating = gradeToRating(grade);
          if (rating === 2 && grade >= 1.5 && grade < 2.5) {
            console.log('FOUND:', { time, switches, gap, entropy, osc, grade, rating });
            process.exit(0);
          }
        }
      }
    }
  }
}
console.log('Not found');