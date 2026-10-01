import * as Location from 'expo-location';

export interface DetectedAddress {
  city: string;
  state: string;
  pincode: string;
}

export class LocationError extends Error {}

/**
 * Asks for location permission, reads the current position once and turns it into
 * city / state / pincode. Any field the device cannot resolve comes back empty so the
 * user can fill it in by hand.
 */
export async function detectAddress(): Promise<DetectedAddress> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new LocationError(
      permission.canAskAgain
        ? 'Location permission was not granted. You can enter your address manually.'
        : 'Location access is turned off for this app. Enable it in Settings or enter your address manually.'
    );
  }

  let place: Location.LocationGeocodedAddress | undefined;
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    [place] = await Location.reverseGeocodeAsync(position.coords);
  } catch {
    throw new LocationError('We couldn’t read your location. Check that location is switched on, or enter your address manually.');
  }
  if (!place) {
    throw new LocationError('We couldn’t find an address for your location. Please enter it manually.');
  }

  return {
    city: place.city ?? place.subregion ?? place.district ?? '',
    state: place.region ?? '',
    pincode: (place.postalCode ?? '').replace(/\D/g, '').slice(0, 6),
  };
}
