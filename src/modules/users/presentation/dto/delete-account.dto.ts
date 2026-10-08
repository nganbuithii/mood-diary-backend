import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'current-password', description: 'Current password, to confirm it is really the owner' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
