import { localTimeIn } from './local-time';

describe('localTimeIn', () => {
  it('returns the local day and hour for a zone ahead of UTC', () => {
    expect(localTimeIn('Asia/Ho_Chi_Minh', new Date('2026-10-08T18:30:00.000Z'))).toEqual({
      day: new Date('2026-10-09T00:00:00.000Z'),
      hour: 1,
    });
  });

  it('returns the local day and hour for a zone behind UTC', () => {
    expect(localTimeIn('America/New_York', new Date('2026-10-08T02:00:00.000Z'))).toEqual({
      day: new Date('2026-10-07T00:00:00.000Z'),
      hour: 22,
    });
  });

  it('reports midnight as hour 0, not 24', () => {
    expect(localTimeIn('UTC', new Date('2026-10-08T00:15:00.000Z')).hour).toBe(0);
  });
});
