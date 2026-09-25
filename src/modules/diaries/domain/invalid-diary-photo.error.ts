export class InvalidDiaryPhotoError extends Error {
  constructor(reason: string) {
    super(`Invalid diary photo: ${reason}`);
    this.name = 'InvalidDiaryPhotoError';
  }
}
