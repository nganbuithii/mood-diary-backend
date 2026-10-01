import { publicIdFromUrl } from './cloudinary-diary-photo-storage';

describe('publicIdFromUrl', () => {
  it('extracts the public_id from a versioned delivery URL', () => {
    expect(
      publicIdFromUrl(
        'https://res.cloudinary.com/demo/image/upload/v1727000000/mood-diary/diary-photos/user-1/3f2a9c1e-uuid.jpg',
      ),
    ).toBe('mood-diary/diary-photos/user-1/3f2a9c1e-uuid');
  });

  it('extracts the public_id from a URL without a version segment', () => {
    expect(
      publicIdFromUrl('https://res.cloudinary.com/demo/image/upload/mood-diary/diary-photos/user-1/abc.png'),
    ).toBe('mood-diary/diary-photos/user-1/abc');
  });

  it.each([
    ['an asset outside the diary photo folder', 'https://res.cloudinary.com/demo/image/upload/v1/avatars/user-1/me.jpg'],
    ['a folder that only starts with the same name', 'https://res.cloudinary.com/demo/image/upload/v1/mood-diary/diary-photos-old/x.jpg'],
    ['a path escaping the folder', 'https://res.cloudinary.com/demo/image/upload/v1/mood-diary/diary-photos/../avatars/x.jpg'],
    ['a non-upload URL', 'https://res.cloudinary.com/demo/image/fetch/mood-diary/diary-photos/user-1/abc.jpg'],
    ['something that is not a URL', 'not a url'],
  ])('returns null for %s', (_label, url) => {
    expect(publicIdFromUrl(url)).toBeNull();
  });
});
