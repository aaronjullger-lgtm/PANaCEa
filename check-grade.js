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
  const base = metric.isCorrect ? 3 : 1;
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
  grade = Math.max(1.0, Math.min(4, grade));
  return grade;
}

const metric = {
  timeToFirstClick: 15000,
  answerSwitches: 0,
  totalDwellTime: 18000,
  isCorrect: true,
  // parTimeMs omitted
};
console.log('grade', calculateGrade(metric));
console.log('latencyRatio', metric.timeToFirstClick / 30000);