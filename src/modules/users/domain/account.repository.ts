import { Mood } from '../../../shared/mood';

export interface AccountExportProfile {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface AccountExportEntry {
  entryDate: Date;
  mood: Mood;
  note: string | null;
  photoUrls: string[];
  isFavorite: boolean;
  songExternalId: string | null;
  songTitle: string | null;
  songArtist: string | null;
  songArtworkUrl: string | null;
  songPreviewUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountExportLetter {
  body: string;
  moodAtWriting: Mood | null;
  deliverAt: Date;
  openedAt: Date | null;
  createdAt: Date;
}

export interface AccountExportData {
  profile: AccountExportProfile;
  entries: AccountExportEntry[];
  letters: AccountExportLetter[];
}

export interface AccountRepository {
  /** Live (not soft-deleted) entries only, oldest first. */
  findExportData(userId: string): Promise<AccountExportData | null>;
  /** Removes the user row; every owned record goes with it through ON DELETE CASCADE. */
  delete(userId: string): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
