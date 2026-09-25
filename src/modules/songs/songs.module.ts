import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { SONG_CATALOG } from './domain/song-catalog';
import { ItunesSongCatalog } from './infrastructure/itunes-song-catalog';
import { SongsController } from './presentation/songs.controller';

@Module({
  imports: [AuthModule],
  controllers: [SongsController],
  providers: [ThrottlerGuard, { provide: SONG_CATALOG, useClass: ItunesSongCatalog }],
  exports: [SONG_CATALOG],
})
export class SongsModule {}
