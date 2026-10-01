import { FutureLetterEntity } from './future-letter.repository';

export type LetterStatus = 'sealed' | 'ready' | 'opened';

export function letterStatus(letter: Pick<FutureLetterEntity, 'deliverAt' | 'openedAt'>, now: Date): LetterStatus {
  if (letter.openedAt) return 'opened';
  return letter.deliverAt.getTime() <= now.getTime() ? 'ready' : 'sealed';
}
