import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../domain/user.repository';

export class UserResponseDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Ngân' })
  displayName: string;

  @ApiProperty({ example: 'ngan@example.com' })
  email: string;

  @ApiProperty({ example: '2026-09-15T10:00:00.000Z' })
  createdAt: Date;

  static fromEntity(user: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.displayName = user.displayName;
    dto.email = user.email;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
