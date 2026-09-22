import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from './application/users.service';
import { AVATAR_STORAGE } from './domain/avatar-storage';
import { USER_PROFILE_REPOSITORY } from './domain/user-profile.repository';
import { CloudinaryAvatarStorage } from './infrastructure/cloudinary-avatar-storage';
import { PrismaUserProfileRepository } from './infrastructure/prisma-user-profile.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
    { provide: AVATAR_STORAGE, useClass: CloudinaryAvatarStorage },
  ],
})
export class UsersModule {}
