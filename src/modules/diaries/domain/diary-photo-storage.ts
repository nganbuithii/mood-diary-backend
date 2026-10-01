export interface DiaryPhotoUploadResult {
  url: string;
}

export interface DiaryPhotoStorage {
  upload(userId: string, file: Buffer): Promise<DiaryPhotoUploadResult>;
  /** Resolves once the photo is gone, including when it was already gone. */
  delete(url: string): Promise<void>;
}

export const DIARY_PHOTO_STORAGE = Symbol('DIARY_PHOTO_STORAGE');
