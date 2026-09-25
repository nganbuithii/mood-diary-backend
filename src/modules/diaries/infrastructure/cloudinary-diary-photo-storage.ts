import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { DiaryPhotoStorage, DiaryPhotoUploadResult } from '../domain/diary-photo-storage';
import { InvalidDiaryPhotoError } from '../domain/invalid-diary-photo.error';

const DIARY_PHOTO_FOLDER = 'mood-diary/diary-photos';

@Injectable()
export class CloudinaryDiaryPhotoStorage implements DiaryPhotoStorage {
  private readonly logger = new Logger(CloudinaryDiaryPhotoStorage.name);

  constructor(configService: ConfigService) {
    cloudinary.config({
      cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  upload(userId: string, file: Buffer): Promise<DiaryPhotoUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: `${userId}/${randomUUID()}`,
          folder: DIARY_PHOTO_FOLDER,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            // multer only checks the client-declared mimetype, so Cloudinary is the
            // first place that actually decodes the file — a 400 here is bad input.
            if (error?.http_code === 400) {
              reject(new InvalidDiaryPhotoError(error.message));
              return;
            }

            this.logger.error(
              `Cloudinary upload failed for user ${userId}: ${error?.http_code ?? 'no-code'} ${error?.message ?? 'empty result'}`,
            );
            reject(new InternalServerErrorException('Failed to upload photo'));
            return;
          }
          resolve({ url: result.secure_url });
        },
      );

      Readable.from(file).pipe(uploadStream);
    });
  }
}
