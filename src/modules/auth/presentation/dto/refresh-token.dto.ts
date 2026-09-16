import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ example: 'f4b7c9...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
