import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { MOODS, Mood } from '../../../../shared/mood';
import { MAX_LETTER_LENGTH } from '../../domain/future-letter.repository';

export class CreateLetterDto {
  @ApiProperty({ maxLength: MAX_LETTER_LENGTH, example: 'Dear future me, I hope the new job turned out well.' })
  @IsString()
  @MaxLength(MAX_LETTER_LENGTH * 2)
  body: string;

  @ApiProperty({
    example: '2027-10-01T01:00:00.000Z',
    description: 'When the letter opens, as an ISO timestamp. The client sends 8:00 local time of the chosen day.',
  })
  @IsISO8601({ strict: true }, { message: 'deliverAt must be an ISO 8601 timestamp' })
  deliverAt: string;

  @ApiProperty({ enum: MOODS, required: false, example: 'HAPPY' })
  @IsOptional()
  @IsIn(MOODS, { message: `moodAtWriting must be one of: ${MOODS.join(', ')}` })
  moodAtWriting?: Mood;
}
