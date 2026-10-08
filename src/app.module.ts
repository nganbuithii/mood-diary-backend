import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DiariesModule } from './modules/diaries/diaries.module';
import { LettersModule } from './modules/letters/letters.module';
import { SongsModule } from './modules/songs/songs.module';
import { RemindersModule } from './modules/reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DiariesModule,
    LettersModule,
    SongsModule,
    RemindersModule,
  ],
})
export class AppModule {}
