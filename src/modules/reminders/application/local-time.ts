export interface LocalTime {
  /** The local calendar day as a UTC-midnight Date, matching how `@db.Date` columns are read. */
  day: Date;
  hour: number;
}

export function localTimeIn(timeZone: string, now: Date): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);

  return {
    day: new Date(Date.UTC(part('year'), part('month') - 1, part('day'))),
    hour: part('hour'),
  };
}
