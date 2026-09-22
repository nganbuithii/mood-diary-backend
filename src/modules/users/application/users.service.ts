import { Inject, Injectable } from '@nestjs/common';
import { AVATAR_STORAGE, AvatarStorage } from '../domain/avatar-storage';
import { USER_PROFILE_REPOSITORY, UserProfileEntity, UserProfileRepository } from '../domain/user-profile.repository';
import { UserNotFoundError } from '../domain/user-not-found.error';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY) private readonly userProfileRepository: UserProfileRepository,
    @Inject(AVATAR_STORAGE) private readonly avatarStorage: AvatarStorage,
  ) {}

  async uploadAvatar(userId: string, file: Buffer): Promise<UserProfileEntity> {
    const user = await this.userProfileRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const { url } = await this.avatarStorage.upload(userId, file);
    return this.userProfileRepository.updateAvatarUrl(userId, url);
  }
}
