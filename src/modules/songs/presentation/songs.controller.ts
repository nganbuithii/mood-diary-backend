import { BadGatewayException, Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { SONG_CATALOG, SongCatalog } from '../domain/song-catalog';
import { SongCatalogUnavailableError } from '../domain/song-catalog-unavailable.error';
import { SearchSongsQueryDto } from './dto/search-songs-query.dto';
import { SongResponseDto } from './dto/song-response.dto';

const SEARCH_RESULT_LIMIT = 10;

@ApiTags('songs')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('songs')
export class SongsController {
  constructor(@Inject(SONG_CATALOG) private readonly songCatalog: SongCatalog) {}

  @Get('trending')
  @ApiOkResponse({ description: 'Most-played songs in Vietnam right now, in chart order (up to 20)', type: [SongResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  @ApiBadGatewayResponse({ description: 'Song catalog is unavailable' })
  async trending(): Promise<SongResponseDto[]> {
    try {
      const songs = await this.songCatalog.trending();
      return songs.map((song) => SongResponseDto.fromSong(song));
    } catch (error) {
      if (error instanceof SongCatalogUnavailableError) {
        throw new BadGatewayException('Trending songs are unavailable right now. Please try again.');
      }
      throw error;
    }
  }

  @Get('search')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ description: 'Songs matching the query', type: [SongResponseDto] })
  @ApiBadRequestResponse({ description: 'Missing or too long query' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  @ApiTooManyRequestsResponse({ description: 'Too many searches, try again in a minute' })
  @ApiBadGatewayResponse({ description: 'Song catalog is unavailable' })
  async search(@Query() query: SearchSongsQueryDto): Promise<SongResponseDto[]> {
    try {
      const songs = await this.songCatalog.search(query.q, SEARCH_RESULT_LIMIT);
      return songs.map((song) => SongResponseDto.fromSong(song));
    } catch (error) {
      if (error instanceof SongCatalogUnavailableError) {
        throw new BadGatewayException('Song search is unavailable right now. Please try again.');
      }
      throw error;
    }
  }
}
