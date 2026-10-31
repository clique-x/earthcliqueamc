import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../api/api_exception.dart';
import '../models/engineer.dart';

class LocationUnavailable implements UserFacingException {
  const LocationUnavailable(this.message);
  @override
  final String message;

  @override
  String toString() => message;
}

abstract final class LocationService {
  static Future<bool> hasPermission() async {
    final p = await Geolocator.checkPermission();
    return p == LocationPermission.always || p == LocationPermission.whileInUse;
  }

  static Future<bool> requestPermission() async {
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    return p == LocationPermission.always || p == LocationPermission.whileInUse;
  }

  /// Current position for going online; throws [LocationUnavailable] with a user-facing message.
  static Future<LatLng> current() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationUnavailable('Turn on location (GPS) to go online.');
    }
    if (!await requestPermission()) {
      throw const LocationUnavailable('Allow location access to go online.');
    }
    try {
      final p = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)),
      );
      return LatLng(p.latitude, p.longitude);
    } on TimeoutException {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) return LatLng(last.latitude, last.longitude);
      throw const LocationUnavailable('Could not get your location. Move to an open area and try again.');
    }
  }
}
