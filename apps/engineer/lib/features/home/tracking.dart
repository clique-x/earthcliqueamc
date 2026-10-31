import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/location/location_tracker.dart';
import '../../core/models/catalog.dart';
import '../../core/session/me_controller.dart';
import '../../core/session/session_controller.dart';
import '../jobs/active_job_provider.dart';

final locationTrackerProvider = Provider<LocationTracker>((ref) {
  final tracker = LocationTracker(ref.read(apiClientProvider));
  ref.onDispose(tracker.dispose);
  return tracker;
});

/// Location is only tracked while online, or while travelling to a job.
final trackingModeProvider = Provider<TrackingMode>((ref) {
  final online = ref.watch(meProvider.select((m) => m.valueOrNull?.isOnline ?? false));
  final status = ref.watch(activeJobProvider.select((j) => j.valueOrNull?.status));
  if (status == TicketStatus.enRoute) return TrackingMode.enRoute;
  return online ? TrackingMode.idle : TrackingMode.off;
});

/// Keep watched from the app root so tracking follows the mode.
final trackingProvider = Provider<void>((ref) {
  final tracker = ref.watch(locationTrackerProvider);
  ref.listen(trackingModeProvider, (_, mode) => tracker.apply(mode), fireImmediately: true);
});
