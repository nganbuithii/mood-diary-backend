import { Song } from '../../songs/domain/song-catalog';

export const DIARY_MOODS = ['VERY_SAD', 'SAD', 'NEUTRAL', 'HAPPY', 'VERY_HAPPY'] as const;

export type DiaryMood = (typeof DIARY_MOODS)[number];

export const MAX_ENTRY_PHOTOS = 3;

export interface DiaryEntryEntity {
  id: string;
  userId: string;
  mood: DiaryMood;
  note: string | null;
  photoUrls: string[];
  songExternalId: string | null;
  songTitle: string | null;
  songArtist: string | null;
  songArtworkUrl: string | null;
  songPreviewUrl: string | null;
  isFavorite: boolean;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertDiaryEntryInput {
  userId: string;
  entryDate: Date;
  mood: DiaryMood;
  note: string | null;
  photoUrls?: string[];
  song?: Song | null;
}

export interface DiaryFeedPageQuery {
  userId: string;
  mood?: DiaryMood;
  /** When true, only favorite entries. */
  favorite?: boolean;
  from?: Date;
  to?: Date;
  before?: Date;
  take: number;
}

export interface DiaryEntryRepository {
  upsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity>;
  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]>;
  findByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null>;
  countByUserOnOrBefore(userId: string, date: Date): Promise<number>;
  findByUserOnOrBeforeAt(userId: string, date: Date, offset: number): Promise<DiaryEntryEntity | null>;
  findEntryDatesOnOrBefore(userId: string, date: Date): Promise<Date[]>;
  findPageNewestFirst(query: DiaryFeedPageQuery): Promise<DiaryEntryEntity[]>;
  /** Returns null when the user has no entry on that date. */
  setFavorite(userId: string, entryDate: Date, isFavorite: boolean): Promise<DiaryEntryEntity | null>;
}

export const DIARY_ENTRY_REPOSITORY = Symbol('DIARY_ENTRY_REPOSITORY');
