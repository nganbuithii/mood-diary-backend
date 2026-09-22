import { Readable } from 'stream';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { AvatarStorage, AvatarUploadResult } from '../domain/avatar-storage';

const AVATAR_FOLDER = 'mood-diary/avatars';

@Injectable()
export class CloudinaryAvatarStorage implements AvatarStorage {
  constructor(configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  upload(userId: string, file: Buffer): Promise<AvatarUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: userId,
          folder: AVATAR_FOLDER,
          overwrite: true,
          invalidate: true,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            reject(new InternalServerErrorException('Failed to upload avatar'));
            return;
          }
          resolve({ url: result.secure_url });
        },
      );

      Readable.from(file).pipe(uploadStream);
    });
  }
}
