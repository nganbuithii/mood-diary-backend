export const MOODS = ['VERY_SAD', 'SAD', 'NEUTRAL', 'HAPPY', 'VERY_HAPPY'] as const;

export type Mood = (typeof MOODS)[number];
