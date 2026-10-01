import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { DiaryPhotoStorage, DiaryPhotoUploadResult } from '../domain/diary-photo-storage';
import { InvalidDiaryPhotoError } from '../domain/invalid-diary-photo.error';

export const DIARY_PHOTO_FOLDER = 'mood-diary/diary-photos';

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

  async delete(url: string): Promise<void> {
    const publicId = publicIdFromUrl(url);
    if (!publicId) {
      throw new Error(`Not a diary photo URL, refusing to delete: ${url}`);
    }

    const result = (await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    })) as { result?: string };
    // "not found" means an earlier attempt already removed it.
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary destroy failed for ${publicId}: ${result.result ?? 'empty result'}`);
    }
  }
}

/**
 * Extracts the Cloudinary public_id from a delivery URL, e.g.
 * https://res.cloudinary.com/demo/image/upload/v17/mood-diary/diary-photos/u1/abc.jpg
 * → mood-diary/diary-photos/u1/abc. Returns null for anything outside the diary photo
 * folder, so a bad URL in the database can never delete an unrelated asset.
 */
export function publicIdFromUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }

  const marker = '/image/upload/';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex === -1) return null;

  const segments = pathname.slice(markerIndex + marker.length).split('/');
  // Skip the optional version segment (v1695...) Cloudinary puts before the public_id.
  if (/^v\d+$/.test(segments[0] ?? '')) segments.shift();

  const publicId = decodeURIComponent(segments.join('/')).replace(/\.[a-z0-9]+$/i, '');
  return publicId.startsWith(`${DIARY_PHOTO_FOLDER}/`) && !publicId.includes('..') ? publicId : null;
}
