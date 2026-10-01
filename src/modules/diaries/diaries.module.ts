import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SongsModule } from '../songs/songs.module';
import { DiariesService } from './application/diaries.service';
import { GetDailyMemoryUseCase } from './application/get-daily-memory.use-case';
import { GetDiaryFeedUseCase } from './application/get-diary-feed.use-case';
import { GetStreakUseCase } from './application/get-streak.use-case';
import { SetDiaryFavoriteUseCase } from './application/set-diary-favorite.use-case';
import { DIARY_ENTRY_REPOSITORY } from './domain/diary-entry.repository';
import { DIARY_PHOTO_STORAGE } from './domain/diary-photo-storage';
import { CloudinaryDiaryPhotoStorage } from './infrastructure/cloudinary-diary-photo-storage';
import { PrismaDiaryEntryRepository } from './infrastructure/prisma-diary-entry.repository';
import { DiariesController } from './presentation/diaries.controller';

@Module({
  imports: [AuthModule, SongsModule],
  controllers: [DiariesController],
  providers: [
    DiariesService,
    GetDailyMemoryUseCase,
    GetStreakUseCase,
    GetDiaryFeedUseCase,
    SetDiaryFavoriteUseCase,
    { provide: DIARY_ENTRY_REPOSITORY, useClass: PrismaDiaryEntryRepository },
    { provide: DIARY_PHOTO_STORAGE, useClass: CloudinaryDiaryPhotoStorage },
  ],
})
export class DiariesModule {}
