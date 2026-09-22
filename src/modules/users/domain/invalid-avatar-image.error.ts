export class InvalidAvatarImageError extends Error {
  constructor(reason: string) {
    super(`Invalid avatar image: ${reason}`);
    this.name = 'InvalidAvatarImageError';
  }
}
