export interface AvatarUploadResult {
  url: string;
}

export interface AvatarStorage {
  upload(userId: string, file: Buffer): Promise<AvatarUploadResult>;
}

export const AVATAR_STORAGE = Symbol('AVATAR_STORAGE');
