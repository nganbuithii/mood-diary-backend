import { Module } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { DeleteAccountUseCase } from './application/delete-account.use-case';
import { ExportAccountUseCase } from './application/export-account.use-case';
import { UsersService } from './application/users.service';
import { ACCOUNT_REPOSITORY } from './domain/account.repository';
import { AVATAR_STORAGE } from './domain/avatar-storage';
import { USER_MEDIA_STORAGE } from './domain/user-media-storage';
import { USER_PROFILE_REPOSITORY } from './domain/user-profile.repository';
import { CloudinaryAvatarStorage } from './infrastructure/cloudinary-avatar-storage';
import { CloudinaryUserMediaStorage } from './infrastructure/cloudinary-user-media-storage';
import { PrismaAccountRepository } from './infrastructure/prisma-account.repository';
import { PrismaUserProfileRepository } from './infrastructure/prisma-user-profile.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    ExportAccountUseCase,
    DeleteAccountUseCase,
    ThrottlerGuard,
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
    { provide: AVATAR_STORAGE, useClass: CloudinaryAvatarStorage },
    { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository },
    { provide: USER_MEDIA_STORAGE, useClass: CloudinaryUserMediaStorage },
  ],
})
export class UsersModule {}
