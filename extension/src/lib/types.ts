// Shapes returned by the Bite Check proxy (see proxy/src/google.ts).

export interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

export interface PhotoAttribution {
  displayName: string;
  uri?: string;
}

export interface Photo {
  name: string;
  widthPx: number;
  heightPx: number;
  attributions: PhotoAttribution[];
  flagContentUri?: string;
}

export interface PlaceDetails {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number } | null;
  googleMapsUri: string | null;
  businessStatus: string | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  openNow: boolean | null;
  photos: Photo[];
}

export interface StreetViewInfo {
  available: boolean;
  panoId?: string;
  heading?: number;
  distanceM?: number;
  date?: string;
}

export type ApiErrorCode =
  | 'bad_request'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'quota'
  | 'timeout'
  | 'upstream'
  | 'network'
  | 'aborted';
