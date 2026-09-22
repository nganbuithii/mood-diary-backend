export interface UserProfileEntity {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileRepository {
  findById(id: string): Promise<UserProfileEntity | null>;
  updateAvatarUrl(id: string, avatarUrl: string): Promise<UserProfileEntity>;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
