import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/json.dart';
import '../../core/models/job.dart';
import '../../core/models/server_event.dart';
import '../../core/realtime/event_bus.dart';
import '../../core/session/session_controller.dart';

final activeJobProvider = AsyncNotifierProvider<ActiveJobController, JobSummary?>(ActiveJobController.new);

/// The engineer's current job (v1 allows one at a time), kept fresh from `ticket.updated` events.
class ActiveJobController extends AsyncNotifier<JobSummary?> {
  @override
  Future<JobSummary?> build() async {
    final token = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
    if (token == null) return null;
    final sub = ref.read(eventBusProvider).stream.listen((e) {
      if (e is TicketUpdatedEvent || e is ConnectedEvent) unawaited(refresh());
    });
    ref.onDispose(sub.cancel);
    return _fetch();
  }

  Future<JobSummary?> _fetch() async {
    final res = await ref.read(apiClientProvider).get('/engineer/jobs', query: {'scope': 'active'});
    final jobs = asJsonList(res).map(JobSummary.fromJson).toList();
    return jobs.firstOrNull;
  }

  Future<void> refresh() async {
    try {
      state = AsyncData(await _fetch());
    } catch (e, st) {
      if (!state.hasValue) state = AsyncError(e, st);
    }
  }
}

final jobHistoryProvider = FutureProvider.autoDispose<List<JobSummary>>((ref) async {
  final res = await ref.watch(apiClientProvider).get('/engineer/jobs', query: {'scope': 'history'});
  return asJsonList(res).map(JobSummary.fromJson).toList();
});
