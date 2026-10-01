import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetDiaryFavoriteDto {
  @ApiProperty({ example: true, description: 'true to add the entry to favorites, false to remove it' })
  @IsBoolean()
  isFavorite: boolean;
}
