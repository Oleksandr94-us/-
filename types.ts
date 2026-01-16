
export type Point = {
  x: number;
  y: number;
};

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface DifficultyConfig {
  initialSpeed: number;
  speedIncrement: number;
  label: string;
}

export interface GameStats {
  score: number;
  highScore: number;
  level: number;
  foodEaten: number;
}

export interface AICommentary {
  comment: string;
  rank: string;
}
