import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/catalog.dart';
import '../models/ring_offer.dart';
import '../models/server_event.dart';
import '../ui/format.dart';

/// Local notifications: the ringing job alert (full-screen, insistent) and plain job updates.
class NotificationService {
  NotificationService({bool foreground = true}) : _foreground = foreground;

  static const ringChannelId = 'job_rings';
  static const updatesChannelId = 'job_updates';
  static const _ringtone = UriAndroidNotificationSound('content://settings/system/ringtone');
  static const _flagInsistent = 4;

  final bool _foreground;
  final _plugin = FlutterLocalNotificationsPlugin();
  final _taps = StreamController<String>.broadcast();

  /// Payloads of notifications the engineer tapped (or that opened the app via full-screen intent).
  Stream<String> get taps => _taps.stream;

  /// Payload of the notification that cold-started the app, if any.
  String? launchPayload;

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> init() async {
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: _foreground ? _onResponse : null,
    );
    await _android?.createNotificationChannel(
      const AndroidNotificationChannel(
        ringChannelId,
        'Job requests',
        description: 'Rings like a phone call when a nearby job is offered',
        importance: Importance.max,
        sound: _ringtone,
        audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
      ),
    );
    await _android?.createNotificationChannel(
      const AndroidNotificationChannel(
        updatesChannelId,
        'Job updates',
        description: 'Changes to your current job',
        importance: Importance.high,
      ),
    );
    if (_foreground) {
      final details = await _plugin.getNotificationAppLaunchDetails();
      if (details?.didNotificationLaunchApp ?? false) launchPayload = details?.notificationResponse?.payload;
    }
  }

  void _onResponse(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null) _taps.add(payload);
  }

  Future<void> showRing(RingOffer ring) async {
    final remaining = ring.expiresAt.difference(DateTime.now());
    if (remaining.isNegative) return;
    final details = AndroidNotificationDetails(
      ringChannelId,
      'Job requests',
      channelDescription: 'Rings like a phone call when a nearby job is offered',
      importance: Importance.max,
      priority: Priority.max,
      category: AndroidNotificationCategory.call,
      fullScreenIntent: true,
      visibility: NotificationVisibility.public,
      sound: _ringtone,
      audioAttributesUsage: AudioAttributesUsage.notificationRingtone,
      additionalFlags: Int32List.fromList(const [_flagInsistent]),
      ongoing: true,
      autoCancel: false,
      timeoutAfter: remaining.inMilliseconds,
      ticker: 'New job request',
    );
    final urgent = ring.isUrgent ? 'URGENT · ' : '';
    await _plugin.show(
      id: ringNotificationId(ring.offerId),
      title: '${urgent}New ${categoryLabel(ring.category)} job · ₹${ring.feeEstimate}',
      body: '${distance(ring.distanceKm)} away · ${ring.title}',
      notificationDetails: NotificationDetails(android: details),
      payload: jsonEncode(ring.toJson()),
    );
  }

  Future<void> cancelRing(String offerId) => _plugin.cancel(id: ringNotificationId(offerId));

  Future<void> showJobUpdate({required String ticketId, required String title, required String body}) => _plugin.show(
    id: ringNotificationId('update:$ticketId'),
    title: title,
    body: body,
    notificationDetails: const NotificationDetails(
      android: AndroidNotificationDetails(updatesChannelId, 'Job updates', importance: Importance.high, priority: Priority.high),
    ),
  );

  Future<bool> requestNotificationPermission() async => await _android?.requestNotificationsPermission() ?? true;

  /// Opens the Android 14+ "full-screen notifications" setting when not granted.
  Future<bool> requestFullScreenIntentPermission() async => await _android?.requestFullScreenIntentPermission() ?? true;

  /// Called from the FCM background isolate, where no UI or providers exist.
  static Future<void> handleBackgroundEvent(ServerEvent event) async {
    final service = NotificationService(foreground: false);
    await service.init();
    switch (event) {
      case RingEvent(:final ring):
        await service.showRing(ring);
      case RingCancelEvent(:final offerId):
        await service.cancelRing(offerId);
      case TicketUpdatedEvent(:final ticketId, :final status):
        if (status == TicketStatus.assigned) {
          await service.showJobUpdate(ticketId: ticketId, title: 'New job assigned', body: 'Open the app to see the details.');
        } else if (status == TicketStatus.cancelled) {
          await service.showJobUpdate(ticketId: ticketId, title: 'Job cancelled', body: 'The company cancelled this job.');
        }
      case ConnectedEvent() || OtherEvent():
        break;
    }
  }
}

/// Stable 31-bit id per offer, so another isolate can cancel the same notification.
@visibleForTesting
int ringNotificationId(String key) {
  var hash = 0x811c9dc5;
  for (final unit in key.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash & 0x7fffffff;
}

/// Overridden in main() with the initialised instance.
final notificationServiceProvider = Provider<NotificationService>((ref) => throw UnimplementedError());
