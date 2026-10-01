import { ApiProperty } from '@nestjs/swagger';
import { MOODS, Mood } from '../../../../shared/mood';
import { LetterSummary } from '../../application/list-letters.use-case';
import { OpenedLetter } from '../../application/open-letter.use-case';

export class LetterSummaryResponseDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: '2027-10-01T01:00:00.000Z' })
  deliverAt: Date;

  @ApiProperty({ example: '2026-10-01T09:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ enum: ['sealed', 'ready', 'opened'], example: 'sealed' })
  status: LetterSummary['status'];

  @ApiProperty({ enum: MOODS, nullable: true, example: 'HAPPY' })
  moodAtWriting: Mood | null;

  @ApiProperty({ nullable: true, description: 'Start of the letter; only present once it has been opened' })
  preview: string | null;

  static from(summary: LetterSummary): LetterSummaryResponseDto {
    return Object.assign(new LetterSummaryResponseDto(), summary);
  }
}

export class OpenedLetterResponseDto {
  @ApiProperty({ example: 'b3f1c2a0-1234-4a5b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({ example: 'Dear future me, I hope the new job turned out well.' })
  body: string;

  @ApiProperty({ enum: MOODS, nullable: true, example: 'HAPPY' })
  moodAtWriting: Mood | null;

  @ApiProperty({ example: '2027-10-01T01:00:00.000Z' })
  deliverAt: Date;

  @ApiProperty({ example: '2026-10-01T09:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2027-10-01T07:12:00.000Z' })
  openedAt: Date;

  static from(letter: OpenedLetter): OpenedLetterResponseDto {
    const dto = new OpenedLetterResponseDto();
    dto.id = letter.id;
    dto.body = letter.body;
    dto.moodAtWriting = letter.moodAtWriting;
    dto.deliverAt = letter.deliverAt;
    dto.createdAt = letter.createdAt;
    dto.openedAt = letter.openedAt;
    return dto;
  }
}
