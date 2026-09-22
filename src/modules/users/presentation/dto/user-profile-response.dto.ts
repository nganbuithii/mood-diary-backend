import { ApiProperty } from '@nestjs/swagger';
import { UserProfileEntity } from '../../domain/user-profile.repository';

export class UserProfileResponseDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'test@example.com' })
  email: string;

  @ApiProperty({ example: 'Ngân' })
  displayName: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/image/upload/v1/mood-diary/avatars/user-1.jpg', nullable: true })
  avatarUrl: string | null;

  static fromEntity(user: UserProfileEntity): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.displayName = user.displayName;
    dto.avatarUrl = user.avatarUrl;
    return dto;
  }
}
