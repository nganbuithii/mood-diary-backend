import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReminderSettings } from '../../domain/reminder-settings';

export class ReminderSettingsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 20, minimum: 0, maximum: 23, description: 'Local hour in timeZone' })
  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @ApiProperty({ example: 'Asia/Ho_Chi_Minh', description: 'IANA time zone name' })
  @IsString()
  @MaxLength(64)
  timeZone: string;

  static fromSettings(settings: ReminderSettings): ReminderSettingsDto {
    const dto = new ReminderSettingsDto();
    dto.enabled = settings.enabled;
    dto.hour = settings.hour;
    dto.timeZone = settings.timeZone;
    return dto;
  }
}
