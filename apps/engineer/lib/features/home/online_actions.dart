import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/location/location_service.dart';
import '../../core/push/push_service.dart';
import '../../core/session/me_controller.dart';
import '../../core/session/session_controller.dart';
import 'tracking.dart';

Future<void> setOnline(WidgetRef ref, bool online) async {
  final me = ref.read(meProvider.notifier);
  if (online) {
    await me.setOnline(true, await LocationService.current());
    return;
  }
  await me.setOnline(false, ref.read(locationTrackerProvider).lastPosition);
}

Future<void> signOut(WidgetRef ref) async {
  if (ref.read(meProvider).valueOrNull?.isOnline ?? false) {
    try {
      await setOnline(ref, false);
    } catch (_) {
      // Signing out must still work offline.
    }
  }
  try {
    await ref.read(apiClientProvider).delete('/engineer/fcm-token');
  } catch (_) {
    // Best effort: the device token is deleted below either way.
  }
  await clearPushToken();
  await ref.read(sessionProvider.notifier).signOut();
}
