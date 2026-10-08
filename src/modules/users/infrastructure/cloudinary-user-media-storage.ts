import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { DIARY_PHOTO_FOLDER } from '../../diaries/infrastructure/cloudinary-diary-photo-storage';
import { UserMediaStorage } from '../domain/user-media-storage';
import { AVATAR_FOLDER } from './cloudinary-avatar-storage';

// Cloudinary deletes at most 1000 assets per call and reports `partial` while more are left.
const MAX_PREFIX_DELETE_ROUNDS = 20;

@Injectable()
export class CloudinaryUserMediaStorage implements UserMediaStorage {
  constructor(configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.deleteByPrefix(`${DIARY_PHOTO_FOLDER}/${userId}/`);

    const avatar = (await cloudinary.uploader.destroy(`${AVATAR_FOLDER}/${userId}`, {
      resource_type: 'image',
      invalidate: true,
    })) as { result?: string };
    if (avatar.result !== 'ok' && avatar.result !== 'not found') {
      throw new Error(`Cloudinary avatar delete failed for user ${userId}: ${avatar.result ?? 'empty result'}`);
    }
  }

  private async deleteByPrefix(prefix: string): Promise<void> {
    for (let round = 0; round < MAX_PREFIX_DELETE_ROUNDS; round++) {
      const response = (await cloudinary.api.delete_resources_by_prefix(prefix, {
        resource_type: 'image',
        invalidate: true,
      })) as { partial?: boolean };
      if (!response.partial) return;
    }
    throw new Error(`Cloudinary still has assets under ${prefix} after ${MAX_PREFIX_DELETE_ROUNDS} rounds`);
  }
}
