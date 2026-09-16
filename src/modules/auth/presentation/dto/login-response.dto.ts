import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../domain/user.repository';
import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  static from(accessToken: string, user: UserEntity): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = accessToken;
    dto.tokenType = 'Bearer';
    dto.user = UserResponseDto.fromEntity(user);
    return dto;
  }
}
