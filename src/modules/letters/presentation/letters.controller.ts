import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { CreateLetterUseCase } from '../application/create-letter.use-case';
import { DeleteLetterUseCase } from '../application/delete-letter.use-case';
import { ListLettersUseCase } from '../application/list-letters.use-case';
import { OpenLetterUseCase } from '../application/open-letter.use-case';
import { letterStatus } from '../domain/letter-status';
import { InvalidLetterError } from '../domain/invalid-letter.error';
import { LetterLimitReachedError } from '../domain/letter-limit-reached.error';
import { LetterNotFoundError } from '../domain/letter-not-found.error';
import { LetterSealedError } from '../domain/letter-sealed.error';
import { CreateLetterDto } from './dto/create-letter.dto';
import { LetterSummaryResponseDto, OpenedLetterResponseDto } from './dto/letter-response.dto';

@ApiTags('letters')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('letters')
export class LettersController {
  constructor(
    private readonly createLetterUseCase: CreateLetterUseCase,
    private readonly listLettersUseCase: ListLettersUseCase,
    private readonly openLetterUseCase: OpenLetterUseCase,
    private readonly deleteLetterUseCase: DeleteLetterUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ description: "The user's letters, soonest delivery first", type: [LetterSummaryResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async list(@CurrentUser() payload: AccessTokenPayload): Promise<LetterSummaryResponseDto[]> {
    const letters = await this.listLettersUseCase.execute(payload.sub);
    return letters.map((letter) => LetterSummaryResponseDto.from(letter));
  }

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedResponse({ description: 'Letter sealed', type: LetterSummaryResponseDto })
  @ApiBadRequestResponse({ description: 'Empty or too long, or delivery date out of range' })
  @ApiConflictResponse({ description: 'Too many sealed letters waiting' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async create(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: CreateLetterDto,
  ): Promise<LetterSummaryResponseDto> {
    try {
      const now = new Date();
      const letter = await this.createLetterUseCase.execute(
        { userId: payload.sub, body: dto.body, deliverAt: new Date(dto.deliverAt), moodAtWriting: dto.moodAtWriting },
        now,
      );
      return LetterSummaryResponseDto.from({
        id: letter.id,
        deliverAt: letter.deliverAt,
        createdAt: letter.createdAt,
        status: letterStatus(letter, now),
        moodAtWriting: letter.moodAtWriting,
        preview: null,
      });
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Post(':id/open')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The letter, now marked as opened', type: OpenedLetterResponseDto })
  @ApiForbiddenResponse({ description: 'Still sealed' })
  @ApiNotFoundResponse({ description: 'No such letter' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async open(
    @CurrentUser() payload: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OpenedLetterResponseDto> {
    try {
      return OpenedLetterResponseDto.from(await this.openLetterUseCase.execute(payload.sub, id));
    } catch (error) {
      throw toHttpError(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Letter deleted for good' })
  @ApiNotFoundResponse({ description: 'No such letter' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async delete(@CurrentUser() payload: AccessTokenPayload, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    try {
      await this.deleteLetterUseCase.execute(payload.sub, id);
    } catch (error) {
      throw toHttpError(error);
    }
  }
}

function toHttpError(error: unknown): unknown {
  if (error instanceof InvalidLetterError) return new BadRequestException(error.message);
  if (error instanceof LetterLimitReachedError) return new ConflictException(error.message);
  if (error instanceof LetterNotFoundError) return new NotFoundException(error.message);
  if (error instanceof LetterSealedError) {
    return new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      error: 'Forbidden',
      message: 'This letter is still sealed',
      deliverAt: error.deliverAt.toISOString(),
    });
  }
  return error;
}
