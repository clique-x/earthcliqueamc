import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../models/server_event.dart';
import '../notifications/notification_service.dart';
import '../realtime/event_bus.dart';
import '../session/session_controller.dart';

/// FCM data messages while the app is in the background or killed.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: AppConfig.firebaseOptions);
  final event = ServerEvent.fromPush(Map<String, Object?>.from(message.data));
  if (event != null) await NotificationService.handleBackgroundEvent(event);
}

abstract final class PushSetup {
  /// Firebase is optional: without the FIREBASE_* dart-defines the app relies on the WebSocket only.
  static Future<bool> init() async {
    if (!AppConfig.firebaseEnabled) return false;
    try {
      await Firebase.initializeApp(options: AppConfig.firebaseOptions);
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
      return true;
    } catch (e) {
      debugPrint('[push] Firebase init failed, using WebSocket only: $e');
      return false;
    }
  }

  static bool get enabled => Firebase.apps.isNotEmpty;
}

/// While signed in: registers the FCM token and forwards foreground pushes to the event bus.
final pushRegistrationProvider = Provider<void>((ref) {
  final token = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
  if (token == null || !PushSetup.enabled) return;

  final api = ref.read(apiClientProvider);
  final bus = ref.read(eventBusProvider);
  final messaging = FirebaseMessaging.instance;

  Future<void> register(String fcmToken) async {
    try {
      await api.post('/engineer/fcm-token', body: {'token': fcmToken});
    } catch (e) {
      debugPrint('[push] token registration failed: $e');
    }
  }

  // The API sends with firebase-admin `send({ token })`, which takes a classic registration token,
  // not the FID that the newer register()/onRegistered flow returns.
  // ignore: deprecated_member_use
  messaging.getToken().then((t) => t == null ? null : register(t)).catchError((Object e) => debugPrint('[push] getToken failed: $e'));
  final subs = <StreamSubscription<Object?>>[
    // ignore: deprecated_member_use
    messaging.onTokenRefresh.listen(register),
    FirebaseMessaging.onMessage.listen((m) {
      final event = ServerEvent.fromPush(Map<String, Object?>.from(m.data));
      if (event != null) bus.add(event);
    }),
  ];
  ref.onDispose(() {
    for (final s in subs) {
      s.cancel();
    }
  });
});

/// Invalidates this device's FCM token so a signed-out phone stops receiving rings.
Future<void> clearPushToken() async {
  if (!PushSetup.enabled) return;
  try {
    // ignore: deprecated_member_use
    await FirebaseMessaging.instance.deleteToken();
  } catch (e) {
    debugPrint('[push] deleteToken failed: $e');
  }
}
