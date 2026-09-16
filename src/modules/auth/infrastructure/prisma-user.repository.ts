import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserInput, UserEntity, UserRepository } from '../domain/user.repository';
import { EmailAlreadyExistsError } from '../domain/email-already-exists.error';

const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    try {
      return await this.prisma.user.create({ data: input });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new EmailAlreadyExistsError(input.email);
      }
      throw error;
    }
  }
}
