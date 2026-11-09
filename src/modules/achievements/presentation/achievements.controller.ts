import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { InvalidEntryDateError } from '../../diaries/domain/invalid-entry-date.error';
import { LocalDateOutOfRangeError } from '../../diaries/domain/local-date-out-of-range.error';
import { GetAchievementsUseCase } from '../application/get-achievements.use-case';
import { MarkAchievementSeenUseCase } from '../application/mark-achievement-seen.use-case';
import { AchievementNotFoundError } from '../domain/achievement-not-found.error';
import { AchievementsResponseDto } from './dto/achievements-response.dto';
import { GetAchievementsQueryDto } from './dto/get-achievements-query.dto';

@ApiTags('achievements')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('achievements')
export class AchievementsController {
  constructor(
    private readonly getAchievementsUseCase: GetAchievementsUseCase,
    private readonly markAchievementSeenUseCase: MarkAchievementSeenUseCase,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'Overview stats, tiered achievements and monthly badges',
    type: AchievementsResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid date, or not the user's local today" })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async get(
    @CurrentUser() payload: AccessTokenPayload,
    @Query() query: GetAchievementsQueryDto,
  ): Promise<AchievementsResponseDto> {
    try {
      return AchievementsResponseDto.from(
        await this.getAchievementsUseCase.execute({ userId: payload.sub, today: query.date }),
      );
    } catch (error) {
      if (error instanceof InvalidEntryDateError || error instanceof LocalDateOutOfRangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'The current level is no longer shown as new' })
  @ApiNotFoundResponse({ description: 'No such achievement' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async markSeen(
    @CurrentUser() payload: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<void> {
    try {
      await this.markAchievementSeenUseCase.execute(payload.sub, id);
    } catch (error) {
      if (error instanceof AchievementNotFoundError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
