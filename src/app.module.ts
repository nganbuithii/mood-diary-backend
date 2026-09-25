import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DiariesModule } from './modules/diaries/diaries.module';
import { SongsModule } from './modules/songs/songs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DiariesModule,
    SongsModule,
  ],
})
export class AppModule {}
