import { BadRequestException, Body, Controller, Get, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AccessTokenPayload } from '../../auth/domain/token-issuer';
import { ACCESS_TOKEN_COOKIE } from '../../auth/infrastructure/auth-cookies';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/current-user.decorator';
import { UserNotFoundError } from '../../users/domain/user-not-found.error';
import { ReminderSettingsService } from '../application/reminder-settings.service';
import { InvalidTimeZoneError } from '../domain/invalid-time-zone.error';
import { ReminderSettingsDto } from './dto/reminder-settings.dto';

@ApiTags('reminders')
@ApiCookieAuth(ACCESS_TOKEN_COOKIE)
@UseGuards(JwtAuthGuard)
@Controller('users/me/reminder')
export class RemindersController {
  constructor(private readonly reminderSettingsService: ReminderSettingsService) {}

  @Get()
  @ApiOkResponse({ description: 'Daily check-in reminder settings', type: ReminderSettingsDto })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async get(@CurrentUser() payload: AccessTokenPayload): Promise<ReminderSettingsDto> {
    try {
      return ReminderSettingsDto.fromSettings(await this.reminderSettingsService.get(payload.sub));
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Put()
  @ApiOkResponse({ description: 'Settings saved', type: ReminderSettingsDto })
  @ApiBadRequestResponse({ description: 'Invalid hour or unknown time zone' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid access token' })
  async update(
    @CurrentUser() payload: AccessTokenPayload,
    @Body() dto: ReminderSettingsDto,
  ): Promise<ReminderSettingsDto> {
    try {
      return ReminderSettingsDto.fromSettings(await this.reminderSettingsService.update(payload.sub, dto));
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private toHttpError(error: unknown): unknown {
    if (error instanceof UserNotFoundError) return new UnauthorizedException('Invalid or expired access token');
    if (error instanceof InvalidTimeZoneError) return new BadRequestException('Unknown time zone');
    return error;
  }
}
