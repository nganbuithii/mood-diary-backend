export interface DiaryPhotoUploadResult {
  url: string;
}

export interface DiaryPhotoStorage {
  upload(userId: string, file: Buffer): Promise<DiaryPhotoUploadResult>;
}

export const DIARY_PHOTO_STORAGE = Symbol('DIARY_PHOTO_STORAGE');
