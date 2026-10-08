export interface UserMediaStorage {
  /** Deletes the avatar and every diary photo of the user. Resolves once nothing is left, including when nothing existed. */
  deleteAllForUser(userId: string): Promise<void>;
}

export const USER_MEDIA_STORAGE = Symbol('USER_MEDIA_STORAGE');
