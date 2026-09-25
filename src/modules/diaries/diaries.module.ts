import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiariesService } from './application/diaries.service';
import { DIARY_ENTRY_REPOSITORY } from './domain/diary-entry.repository';
import { DIARY_PHOTO_STORAGE } from './domain/diary-photo-storage';
import { CloudinaryDiaryPhotoStorage } from './infrastructure/cloudinary-diary-photo-storage';
import { PrismaDiaryEntryRepository } from './infrastructure/prisma-diary-entry.repository';
import { DiariesController } from './presentation/diaries.controller';

@Module({
  imports: [AuthModule],
  controllers: [DiariesController],
  providers: [
    DiariesService,
    { provide: DIARY_ENTRY_REPOSITORY, useClass: PrismaDiaryEntryRepository },
    { provide: DIARY_PHOTO_STORAGE, useClass: CloudinaryDiaryPhotoStorage },
  ],
})
export class DiariesModule {}
