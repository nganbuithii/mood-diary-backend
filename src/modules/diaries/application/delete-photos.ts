import { DiaryPhotoStorage } from '../domain/diary-photo-storage';

/** Deletes every photo it can and returns the URLs that failed, so callers decide what a failure means. */
export async function deletePhotos(storage: DiaryPhotoStorage, urls: string[]): Promise<string[]> {
  const results = await Promise.allSettled(urls.map((url) => storage.delete(url)));
  return urls.filter((_url, index) => results[index].status === 'rejected');
}
