import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/notifications/notification_service.dart';
import 'core/push/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PushSetup.init();
  final notifications = NotificationService();
  await notifications.init();
  runApp(ProviderScope(overrides: [notificationServiceProvider.overrideWithValue(notifications)], child: const EngineerApp()));
}
