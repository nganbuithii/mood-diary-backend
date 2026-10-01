import { ConfigService } from '@nestjs/config';
import { SendDueLetterEmailsUseCase, sealedAgo } from './send-due-letter-emails.use-case';
import { InMemoryFutureLetterRepository, buildLetter } from './testing/in-memory-future-letter.repository';
import { MAX_EMAIL_ATTEMPTS } from '../domain/future-letter.repository';
import { MailSender, SendLetterReadyEmailInput } from '../../mail/domain/mail-sender';

const NOW = new Date('2026-10-01T10:05:00.000Z');
const DUE = new Date('2026-10-01T01:00:00.000Z');

class FakeMailSender implements MailSender {
  public sent: SendLetterReadyEmailInput[] = [];
  public failFor = new Set<string>();

  sendPasswordResetEmail(): Promise<void> {
    throw new Error('not used in letter email tests');
  }

  sendLetterReadyEmail(input: SendLetterReadyEmailInput): Promise<void> {
    if (this.failFor.has(input.to)) return Promise.reject(new Error('smtp down'));
    this.sent.push(input);
    return Promise.resolve();
  }
}

function setup(letters: ReturnType<typeof buildLetter>[], emails: Record<string, string> = {}) {
  const repository = new InMemoryFutureLetterRepository(letters, emails);
  const mailSender = new FakeMailSender();
  const config = { get: (_key: string, fallback?: string) => fallback } as unknown as ConfigService;
  return { repository, mailSender, useCase: new SendDueLetterEmailsUseCase(repository, mailSender, config) };
}

describe('SendDueLetterEmailsUseCase', () => {
  it('emails the writer once their letter is due, with a link but not the letter itself', async () => {
    const { repository, mailSender, useCase } = setup([buildLetter({ deliverAt: DUE, body: 'top secret words' })], {
      'user-1': 'me@test.dev',
    });

    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 1, failed: 0 });
    expect(mailSender.sent).toEqual([
      { to: 'me@test.dev', openLink: 'http://localhost:3000/letters/letter-a', sealedAgo: 'yesterday' },
    ]);
    expect(JSON.stringify(mailSender.sent)).not.toContain('top secret');
    expect(repository.letters[0].emailSentAt).toEqual(NOW);
  });

  it('never emails the same letter twice', async () => {
    const { mailSender, useCase } = setup([buildLetter({ deliverAt: DUE })]);

    await useCase.execute(NOW);
    await useCase.execute(new Date(NOW.getTime() + 60 * 60 * 1000));

    expect(mailSender.sent).toHaveLength(1);
  });

  it('skips letters that are still sealed or already opened in the app', async () => {
    const { mailSender, useCase } = setup([
      buildLetter({ id: 'sealed', deliverAt: new Date('2027-01-01T01:00:00.000Z') }),
      buildLetter({ id: 'opened', deliverAt: DUE, openedAt: new Date('2026-10-01T08:00:00.000Z') }),
    ]);

    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(mailSender.sent).toEqual([]);
  });

  it('retries a failed email on the next run, then gives up after the maximum attempts', async () => {
    const { repository, mailSender, useCase } = setup([buildLetter({ deliverAt: DUE })], { 'user-1': 'down@test.dev' });
    mailSender.failFor.add('down@test.dev');

    for (let run = 0; run < MAX_EMAIL_ATTEMPTS; run++) {
      await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 0, failed: 1 });
    }
    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 0, failed: 0 });
    expect(repository.letters[0]).toMatchObject({ emailSentAt: null, emailAttempts: MAX_EMAIL_ATTEMPTS });
  });

  it('keeps going when one email fails', async () => {
    const { mailSender, useCase } = setup(
      [buildLetter({ id: 'letter-a', userId: 'user-1', deliverAt: DUE }), buildLetter({ id: 'letter-b', userId: 'user-2', deliverAt: DUE })],
      { 'user-1': 'down@test.dev', 'user-2': 'fine@test.dev' },
    );
    mailSender.failFor.add('down@test.dev');

    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(mailSender.sent.map((email) => email.to)).toEqual(['fine@test.dev']);
  });

  it('keeps going when a letter is deleted while its email is failing', async () => {
    const { repository, mailSender, useCase } = setup(
      [buildLetter({ id: 'letter-a', userId: 'user-1', deliverAt: DUE }), buildLetter({ id: 'letter-b', userId: 'user-2', deliverAt: DUE })],
      { 'user-1': 'down@test.dev', 'user-2': 'fine@test.dev' },
    );
    const send = mailSender.sendLetterReadyEmail.bind(mailSender);
    mailSender.sendLetterReadyEmail = async (input) => {
      if (input.to === 'down@test.dev') {
        await repository.delete('user-1', 'letter-a');
        throw new Error('smtp down');
      }
      return send(input);
    };

    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 1, failed: 1 });
    expect(mailSender.sent.map((email) => email.to)).toEqual(['fine@test.dev']);
  });

  it('works through more due letters than fit in one batch', async () => {
    const letters = Array.from({ length: 120 }, (_, index) =>
      buildLetter({ id: `letter-${String(index).padStart(3, '0')}`, deliverAt: DUE }),
    );
    const { mailSender, useCase } = setup(letters);

    await expect(useCase.execute(NOW)).resolves.toEqual({ sent: 120, failed: 0 });
    expect(mailSender.sent).toHaveLength(120);
  });
});

describe('sealedAgo', () => {
  const now = new Date('2027-10-01T01:00:00.000Z');
  const ago = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it.each([
    [1, 'yesterday'],
    [10, '10 days ago'],
    [60, '2 months ago'],
    [365, 'last year'],
    [3 * 365, '3 years ago'],
  ])('describes %i days as "%s"', (days, expected) => {
    expect(sealedAgo(ago(days), now)).toBe(expected);
  });
});
