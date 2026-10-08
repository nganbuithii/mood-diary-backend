export class InvalidTimeZoneError extends Error {
  constructor(timeZone: string) {
    super(`Unknown time zone: ${timeZone}`);
    this.name = 'InvalidTimeZoneError';
  }
}
