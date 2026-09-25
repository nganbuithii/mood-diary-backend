import { ApiProperty } from '@nestjs/swagger';
import { Song } from '../../domain/song-catalog';

export class SongResponseDto {
  @ApiProperty({ example: '1445931937' })
  id: string;

  @ApiProperty({ example: 'Sunflower' })
  title: string;

  @ApiProperty({ example: 'Post Malone & Swae Lee' })
  artist: string;

  @ApiProperty({ type: String, nullable: true, example: 'https://is1-ssl.mzstatic.com/image/thumb/.../100x100bb.jpg' })
  artworkUrl: string | null;

  @ApiProperty({ type: String, nullable: true, description: '30-second preview clip', example: 'https://audio-ssl.itunes.apple.com/.../preview.m4a' })
  previewUrl: string | null;

  static fromSong(song: Song): SongResponseDto {
    const dto = new SongResponseDto();
    dto.id = song.id;
    dto.title = song.title;
    dto.artist = song.artist;
    dto.artworkUrl = song.artworkUrl;
    dto.previewUrl = song.previewUrl;
    return dto;
  }
}
