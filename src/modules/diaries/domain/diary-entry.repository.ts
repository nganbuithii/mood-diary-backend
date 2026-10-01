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
  deletedAt: Date | null;
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
  /** Omit to keep the current value. */
  isFavorite?: boolean;
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

// Soft-deleted entries are invisible to every read below except findDeletedByUserAndDate and
export interface DiaryEntryRepository {
  /** Also brings a soft-deleted entry on that date back to life. */
  upsert(input: UpsertDiaryEntryInput): Promise<DiaryEntryEntity>;
  findManyByUserInRange(userId: string, from: Date, to: Date): Promise<DiaryEntryEntity[]>;
  findByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null>;
  countByUserOnOrBefore(userId: string, date: Date): Promise<number>;
  findByUserOnOrBeforeAt(userId: string, date: Date, offset: number): Promise<DiaryEntryEntity | null>;
  findEntryDatesOnOrBefore(userId: string, date: Date): Promise<Date[]>;
  findPageNewestFirst(query: DiaryFeedPageQuery): Promise<DiaryEntryEntity[]>;
  /** Returns null when the user has no entry on that date. */
  setFavorite(userId: string, entryDate: Date, isFavorite: boolean): Promise<DiaryEntryEntity | null>;
  findDeletedByUserAndDate(userId: string, entryDate: Date): Promise<DiaryEntryEntity | null>;
  /** Returns false when there is no live entry on that date. */
  softDelete(userId: string, entryDate: Date, deletedAt: Date): Promise<boolean>;
  /** Entries soft-deleted before `cutoff`, ordered by id; pass the last id seen as `afterId` to page. */
  findDeletedBefore(cutoff: Date, take: number, afterId?: string): Promise<DiaryEntryEntity[]>;
  /** Removes the row for good, but only if it is still soft-deleted before `cutoff`. */
  purge(id: string, cutoff: Date): Promise<boolean>;
}

export const DIARY_ENTRY_REPOSITORY = Symbol('DIARY_ENTRY_REPOSITORY');
