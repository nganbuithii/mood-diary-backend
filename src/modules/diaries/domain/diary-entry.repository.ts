export const DIARY_MOODS = ['VERY_SAD', 'SAD', 'NEUTRAL', 'HAPPY', 'VERY_HAPPY'] as const;

export type DiaryMood = (typeof DIARY_MOODS)[number];

export const MAX_ENTRY_PHOTOS = 3;

export interface DiaryEntryEntity {
  id: string;
  userId: string;
  mood: DiaryMood;
  note: string | null;
  photoUrls: string[];
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertDiaryEntryInput {
  userId: string;
  entryDate: Date;
  mood: DiaryMood;
  note: string | null;
  /** Omitted: an existing entry keeps its photos; a new entry starts with none. */
  photoUrls?: string[];
}

export interface DiaryEntryRepository {
  upsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity>;
  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]>;
}

export const DIARY_ENTRY_REPOSITORY = Symbol('DIARY_ENTRY_REPOSITORY');
