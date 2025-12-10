/**
 * FSRS v5 Algorithm Implementation
 * Based on: https://github.com/open-spaced-repetition/fsrs.js
 */

export enum FSRSState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export interface FSRSCard {
  stability: number; // S
  difficulty: number; // D
  state: FSRSState;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  last_review: Date;
}

export interface FSRSReviewLog {
  rating: Rating;
  scheduled_days: number;
  elapsed_days: number;
  review: Date;
  state: FSRSState;
}

export interface FSRSParameters {
  request_retention: number;
  maximum_interval: number;
  w: number[];
}

export const defaultParameters: FSRSParameters = {
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    0.40255, 1.18385, 3.173, 15.69105, 7.19605, 0.5345, 1.4604, 0.0046, 1.54575,
    0.1192, 1.01925, 1.9395, 0.41, 0.75825, 0.143, 0.96455, 0.2764, 0.5982,
    0.39155,
  ],
};

export class FSRS {
  private p: FSRSParameters;

  constructor(parameters: FSRSParameters = defaultParameters) {
    this.p = parameters;
  }

  createEmptyCard(): FSRSCard {
    return {
      stability: 0,
      difficulty: 0,
      state: FSRSState.New,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      last_review: new Date(),
    };
  }

  schedule(card: FSRSCard, now: Date): Record<Rating, { card: FSRSCard; due: Date }> {
    const scheduled: any = {};
    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      scheduled[rating] = this.next(card, now, rating);
    }
    return scheduled;
  }

  next(card: FSRSCard, now: Date, rating: Rating): { card: FSRSCard; due: Date } {
    let newCard = { ...card };
    
    if (card.state === FSRSState.New) {
      newCard.elapsed_days = 0;
    } else {
      newCard.elapsed_days = (now.getTime() - card.last_review.getTime()) / 86400000;
    }
    
    newCard.last_review = now;
    newCard.reps += 1;

    if (rating === Rating.Again) {
      newCard.lapses += 1;
    }

    // Algorithm logic
    if (card.state === FSRSState.New) {
      this.init_ds(newCard, rating);
      newCard.state = FSRSState.Learning;
    } else if (card.state === FSRSState.Learning || card.state === FSRSState.Relearning) {
      this.next_ds(newCard, rating);
      newCard.state = rating === Rating.Good || rating === Rating.Easy ? FSRSState.Review : FSRSState.Learning;
    } else if (card.state === FSRSState.Review) {
      const interval = card.elapsed_days;
      const last_d = card.difficulty;
      const last_s = card.stability;
      const retrievability = Math.pow(1 + interval / (9 * last_s), -1);
      
      this.next_ds(newCard, rating);
      
      if (rating === Rating.Again) {
        newCard.state = FSRSState.Relearning;
        newCard.stability = this.next_forget_stability(last_d, last_s, retrievability);
      } else {
        newCard.stability = this.next_recall_stability(last_d, last_s, retrievability, rating);
      }
    }

    // Calculate next interval
    let next_interval = 1;
    if (newCard.state === FSRSState.Review) {
      next_interval = this.next_interval(newCard.stability);
    } else {
      // Learning steps (simplified)
      // Again: 5min, Hard: 10min, Good: 1day, Easy: 4days
      // We map this to days for simplicity in this DB model
      if (rating === Rating.Again) next_interval = 0.0035; // ~5 min
      else if (rating === Rating.Hard) next_interval = 0.007; // ~10 min
      else if (rating === Rating.Good) next_interval = 1;
      else if (rating === Rating.Easy) next_interval = 4;
    }

    newCard.scheduled_days = next_interval;
    const due = new Date(now.getTime() + next_interval * 86400000);

    return { card: newCard, due };
  }

  private init_ds(card: FSRSCard, rating: Rating) {
    card.stability = this.p.w[rating - 1];
    card.difficulty = this.p.w[4] - (rating - 3) * this.p.w[5];
    card.difficulty = this.constrain_difficulty(card.difficulty);
  }

  private next_ds(card: FSRSCard, rating: Rating) {
    const next_d = card.difficulty - this.p.w[6] * (rating - 3);
    card.difficulty = this.constrain_difficulty(this.mean_reversion(this.p.w[4], next_d));
  }

  private constrain_difficulty(d: number): number {
    return Math.min(Math.max(d, 1), 10);
  }

  private mean_reversion(init: number, current: number): number {
    return this.p.w[7] * init + (1 - this.p.w[7]) * current;
  }

  private next_recall_stability(d: number, s: number, r: number, rating: Rating): number {
    const hard_penalty = rating === Rating.Hard ? this.p.w[15] : 1;
    const easy_bonus = rating === Rating.Easy ? this.p.w[16] : 1;
    return s * (1 + Math.exp(this.p.w[8]) *
      (11 - d) *
      Math.pow(s, -this.p.w[9]) *
      (Math.exp((1 - r) * this.p.w[10]) - 1) *
      hard_penalty *
      easy_bonus);
  }

  private next_forget_stability(d: number, s: number, r: number): number {
    return this.p.w[11] *
      Math.pow(d, -this.p.w[12]) *
      (Math.pow(s + 1, this.p.w[13]) - 1) *
      Math.exp((1 - r) * this.p.w[14]);
  }

  private next_interval(s: number): number {
    const new_interval = s * 9 * (1 / this.p.request_retention - 1);
    return Math.min(Math.max(new_interval, 1), this.p.maximum_interval);
  }
}
