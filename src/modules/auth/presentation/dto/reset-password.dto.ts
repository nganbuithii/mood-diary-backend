import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'raw-token-from-the-email-link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'new-strong-password', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'newPassword must be at least 8 characters' })
  @MaxLength(128)
  newPassword: string;
}
