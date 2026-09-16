export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserEntity | null>;
  create(input: CreateUserInput): Promise<UserEntity>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
