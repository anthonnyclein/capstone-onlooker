import { RubricCriterion, LatePolicy, CriterionAssessment } from '../types';
import { calculateDaysLate } from './dateUtils';

export interface ScoreCalculationResult {
  criterionAssessments: Record<string, CriterionAssessment>;
  rubricRawScore: number;
  rubricMaxScore: number;
  taskRawScore: number;
  daysLate: number;
  lateDeduction: number;
  finalScore: number;
  deductionExplanation: string;
}

export function calculateLateDeduction(
  latePolicy: LatePolicy,
  daysLate: number,
  taskMaxScore?: number
): number {
  if (daysLate <= 0 || latePolicy.type === 'none') return 0;
  let deduction = 0;
  if (latePolicy.type === 'fixed') {
    deduction = latePolicy.deductionAmount || 0;
  } else if (latePolicy.type === 'per_day') {
    deduction = daysLate * (latePolicy.deductionAmount || 0);
  }
  if (latePolicy.maxDeduction !== undefined && latePolicy.maxDeduction > 0) {
    deduction = Math.min(deduction, latePolicy.maxDeduction);
  }
  if (taskMaxScore !== undefined) {
    deduction = Math.min(deduction, taskMaxScore);
  }
  return deduction;
}

export function calculateSubmissionScore(
  rubric: RubricCriterion[],
  selectedLevels: Record<string, string>, // criterionId -> levelName
  taskMaxScore: number,
  latePolicy: LatePolicy,
  submissionTimeIso?: string,
  deadlineIso?: string
): ScoreCalculationResult {
  const criterionAssessments: Record<string, CriterionAssessment> = {};
  let rubricRawScore = 0;
  let rubricMaxScore = 0;

  for (const crit of rubric) {
    rubricMaxScore += crit.maxPoints;
    const selectedLevelName = selectedLevels[crit.id];
    const levelObj = crit.levels.find(l => l.name === selectedLevelName);
    
    // If not selected, percentage is 0
    const percentage = levelObj ? levelObj.percentage : 0;
    const score = Math.round(crit.maxPoints * percentage * 100) / 100;

    criterionAssessments[crit.id] = {
      criterionId: crit.id,
      levelName: selectedLevelName || 'Not Assessed',
      percentage,
      score,
      maxPoints: crit.maxPoints,
    };

    rubricRawScore += score;
  }

  // Scale rubric score proportionally to task maximum
  const taskRawScore = rubricMaxScore > 0 
    ? Math.round(((rubricRawScore / rubricMaxScore) * taskMaxScore) * 100) / 100
    : 0;

  // Lateness deduction calculation
  let daysLate = 0;
  let lateDeduction = 0;
  let deductionExplanation = 'On time: No deduction applied.';

  if (submissionTimeIso && deadlineIso) {
    daysLate = calculateDaysLate(submissionTimeIso, deadlineIso);
  }

  if (daysLate > 0) {
    if (latePolicy.type === 'none') {
      deductionExplanation = `${daysLate} day(s) late, but task policy is "No deduction".`;
    } else if (latePolicy.type === 'fixed') {
      let deduction = latePolicy.deductionAmount || 0;
      if (latePolicy.maxDeduction !== undefined && latePolicy.maxDeduction > 0) {
        deduction = Math.min(deduction, latePolicy.maxDeduction);
      }
      lateDeduction = deduction;
      deductionExplanation = `Submitted late (${daysLate} day(s)). Fixed deduction of ${deduction} pt(s).`;
    } else if (latePolicy.type === 'per_day') {
      const perDay = latePolicy.deductionAmount || 0;
      let calculated = daysLate * perDay;
      if (latePolicy.maxDeduction !== undefined && latePolicy.maxDeduction > 0) {
        calculated = Math.min(calculated, latePolicy.maxDeduction);
        deductionExplanation = `Submitted ${daysLate} day(s) late at ${perDay} pts/day (capped at max ${latePolicy.maxDeduction} pts): -${calculated} pt(s).`;
      } else {
        deductionExplanation = `Submitted ${daysLate} day(s) late at ${perDay} pts/day: -${calculated} pt(s).`;
      }
      lateDeduction = calculated;
    }
  }

  // Final score minimum is zero
  const finalScore = Math.max(0, Math.round((taskRawScore - lateDeduction) * 100) / 100);

  return {
    criterionAssessments,
    rubricRawScore: Math.round(rubricRawScore * 100) / 100,
    rubricMaxScore,
    taskRawScore,
    daysLate,
    lateDeduction,
    finalScore,
    deductionExplanation,
  };
}
