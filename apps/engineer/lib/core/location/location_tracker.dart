import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../api/api_client.dart';
import '../models/engineer.dart';

enum TrackingMode { off, idle, enRoute }

/// Streams GPS via a foreground service and posts heartbeats: every 60 s idle, every 10 s while en route.
class LocationTracker {
  LocationTracker(this._api);

  final ApiClient _api;
  StreamSubscription<Position>? _positions;
  Timer? _timer;
  Position? _last;
  TrackingMode _mode = TrackingMode.off;

  TrackingMode get mode => _mode;

  LatLng? get lastPosition => _last == null ? null : LatLng(_last!.latitude, _last!.longitude);

  static final _settings = AndroidSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10,
    intervalDuration: const Duration(seconds: 5),
    foregroundNotificationConfig: const ForegroundNotificationConfig(
      notificationTitle: 'You are online',
      notificationText: 'Sharing your location so nearby jobs can reach you',
      notificationChannelName: 'Online status',
      enableWakeLock: true,
      setOngoing: true,
    ),
  );

  Future<void> apply(TrackingMode mode) async {
    if (mode == _mode) return;
    _mode = mode;
    _timer?.cancel();
    if (mode == TrackingMode.off) {
      await _positions?.cancel();
      _positions = null;
      return;
    }
    _positions ??= Geolocator.getPositionStream(
      locationSettings: _settings,
    ).listen((p) => _last = p, onError: (Object e) => debugPrint('[location] stream error: $e'));
    final interval = mode == TrackingMode.enRoute ? const Duration(seconds: 10) : const Duration(seconds: 60);
    _timer = Timer.periodic(interval, (_) => _post());
    unawaited(_post());
  }

  Future<void> _post() async {
    final p = _last ?? await Geolocator.getLastKnownPosition();
    if (p == null) return;
    try {
      await _api.post('/engineer/location', body: {'lat': p.latitude, 'lng': p.longitude});
    } catch (e) {
      debugPrint('[location] heartbeat failed: $e');
    }
  }

  Future<void> dispose() => apply(TrackingMode.off);
}
