import { UsersService } from './users.service';
import { UserNotFoundError } from '../domain/user-not-found.error';
import { UserProfileEntity, UserProfileRepository } from '../domain/user-profile.repository';
import { AvatarStorage, AvatarUploadResult } from '../domain/avatar-storage';

function buildUser(overrides: Partial<UserProfileEntity> = {}): UserProfileEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    displayName: 'Ngân',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

class FakeUserProfileRepository implements UserProfileRepository {
  public updateAvatarUrlCalls: Array<{ id: string; avatarUrl: string }> = [];

  constructor(private readonly usersById: Map<string, UserProfileEntity>) {}

  findById(id: string): Promise<UserProfileEntity | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  updateAvatarUrl(id: string, avatarUrl: string): Promise<UserProfileEntity> {
    this.updateAvatarUrlCalls.push({ id, avatarUrl });
    const existing = this.usersById.get(id);
    if (!existing) {
      throw new Error('user not found in fake repository');
    }
    const updated = { ...existing, avatarUrl };
    this.usersById.set(id, updated);
    return Promise.resolve(updated);
  }
}

class FakeAvatarStorage implements AvatarStorage {
  public uploadCalls: Array<{ userId: string; file: Buffer }> = [];

  constructor(private readonly result: AvatarUploadResult) {}

  upload(userId: string, file: Buffer): Promise<AvatarUploadResult> {
    this.uploadCalls.push({ userId, file });
    return Promise.resolve(this.result);
  }
}

describe('UsersService', () => {
  function setup(user: UserProfileEntity | null) {
    const userProfileRepository = new FakeUserProfileRepository(user ? new Map([[user.id, user]]) : new Map());
    const avatarStorage = new FakeAvatarStorage({ url: 'https://res.cloudinary.com/demo/avatars/user-1.jpg' });
    const service = new UsersService(userProfileRepository, avatarStorage);
    return { service, userProfileRepository, avatarStorage };
  }

  it('uploads the file to avatar storage and persists the returned URL', async () => {
    const user = buildUser();
    const { service, userProfileRepository, avatarStorage } = setup(user);
    const file = Buffer.from('fake-image-bytes');

    const result = await service.uploadAvatar(user.id, file);

    expect(avatarStorage.uploadCalls).toEqual([{ userId: user.id, file }]);
    expect(userProfileRepository.updateAvatarUrlCalls).toEqual([
      { id: user.id, avatarUrl: 'https://res.cloudinary.com/demo/avatars/user-1.jpg' },
    ]);
    expect(result.avatarUrl).toBe('https://res.cloudinary.com/demo/avatars/user-1.jpg');
  });

  it('rejects with UserNotFoundError when the user does not exist', async () => {
    const { service, avatarStorage } = setup(null);

    await expect(service.uploadAvatar('missing-user', Buffer.from('x'))).rejects.toThrow(UserNotFoundError);
    expect(avatarStorage.uploadCalls).toHaveLength(0);
  });
});
