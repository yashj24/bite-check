// The ONLY values persisted by Bite Check:
//  - lastPlaceId: a Google place_id (the one Places value Google lets you store)
//  - maxPhotos:   a user preference
// No names, addresses, photos or other Places content are ever written to storage.

export const DEFAULT_MAX_PHOTOS = 6;
export const PHOTO_CAP_OPTIONS = [4, 6, 8] as const;

export async function getLastPlaceId(): Promise<string | null> {
  try {
    const { lastPlaceId } = await chrome.storage.local.get('lastPlaceId');
    return typeof lastPlaceId === 'string' ? lastPlaceId : null;
  } catch {
    return null;
  }
}

export async function setLastPlaceId(placeId: string): Promise<void> {
  try {
    await chrome.storage.local.set({ lastPlaceId: placeId });
  } catch {
    /* non-critical */
  }
}

export async function getMaxPhotos(): Promise<number> {
  try {
    const { maxPhotos } = await chrome.storage.sync.get('maxPhotos');
    return (PHOTO_CAP_OPTIONS as readonly number[]).includes(maxPhotos) ? maxPhotos : DEFAULT_MAX_PHOTOS;
  } catch {
    return DEFAULT_MAX_PHOTOS;
  }
}

export async function setMaxPhotos(n: number): Promise<void> {
  try {
    await chrome.storage.sync.set({ maxPhotos: n });
  } catch {
    /* non-critical */
  }
}
