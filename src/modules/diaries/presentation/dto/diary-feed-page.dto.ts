import { ApiProperty } from '@nestjs/swagger';
import { DiaryFeedPage } from '../../application/get-diary-feed.use-case';
import { DiaryEntryResponseDto } from './diary-entry-response.dto';

export class DiaryFeedPageDto {
  @ApiProperty({ type: [DiaryEntryResponseDto], description: 'Newest entry date first' })
  items: DiaryEntryResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'eyJkIjoiMjAyNi0wOS0yOCJ9',
    description: 'Pass as cursor to get the next page; null when there are no more entries',
  })
  nextCursor: string | null;

  static from(page: DiaryFeedPage): DiaryFeedPageDto {
    const dto = new DiaryFeedPageDto();
    dto.items = page.entries.map((entry) => DiaryEntryResponseDto.fromEntity(entry));
    dto.nextCursor = page.nextCursor;
    return dto;
  }
}
