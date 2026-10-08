import { Inject, Injectable } from '@nestjs/common';
import { LetterStatus, letterStatus } from '../../letters/domain/letter-status';
import {
  ACCOUNT_REPOSITORY,
  AccountExportEntry,
  AccountExportLetter,
  AccountExportProfile,
  AccountRepository,
} from '../domain/account.repository';
import { UserNotFoundError } from '../domain/user-not-found.error';

export interface ExportedLetter extends Omit<AccountExportLetter, 'body'> {
  status: LetterStatus;
  /** null while the letter is still sealed, so exporting never spoils it. */
  body: string | null;
}

export interface AccountExport {
  exportedAt: Date;
  profile: AccountExportProfile;
  entries: AccountExportEntry[];
  letters: ExportedLetter[];
}

@Injectable()
export class ExportAccountUseCase {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accountRepository: AccountRepository) {}

  async execute(userId: string, now: Date = new Date()): Promise<AccountExport> {
    const data = await this.accountRepository.findExportData(userId);
    if (!data) {
      throw new UserNotFoundError(userId);
    }

    return {
      exportedAt: now,
      profile: data.profile,
      entries: data.entries,
      letters: data.letters.map((letter) => {
        const status = letterStatus(letter, now);
        return { ...letter, status, body: status === 'sealed' ? null : letter.body };
      }),
    };
  }
}
