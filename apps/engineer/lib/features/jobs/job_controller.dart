import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/json.dart';
import '../../core/models/job.dart';
import '../../core/models/server_event.dart';
import '../../core/realtime/event_bus.dart';
import '../../core/realtime/realtime_service.dart';
import '../../core/session/session_controller.dart';
import 'active_job_provider.dart';

final jobProvider = AsyncNotifierProvider.autoDispose.family<JobController, JobDetail, String>(JobController.new);

class JobController extends AutoDisposeFamilyAsyncNotifier<JobDetail, String> {
  String get _base => '/engineer/jobs/$arg';

  @override
  Future<JobDetail> build(String id) async {
    final sub = ref.read(eventBusProvider).stream.listen((e) {
      if ((e is TicketUpdatedEvent && e.ticketId == id) || e is ConnectedEvent) unawaited(reload());
    });
    final realtime = ref.read(realtimeProvider)?..subscribe(id);
    ref.onDispose(() {
      sub.cancel();
      realtime?.unsubscribe(id);
    });
    return _fetch();
  }

  Future<JobDetail> _fetch() async => JobDetail.fromJson(asJson(await ref.read(apiClientProvider).get(_base)));

  Future<void> reload() async {
    try {
      state = AsyncData(await _fetch());
    } catch (e, st) {
      // Keep showing the job on transient errors; a 404 means it is no longer ours.
      if (!state.hasValue || (e is ApiException && e.statusCode == 404)) state = AsyncError(e, st);
    }
  }

  Future<void> _action(String action, [Json? body]) async {
    await ref.read(apiClientProvider).post('$_base/$action', body: body);
    await reload();
    unawaited(ref.read(activeJobProvider.notifier).refresh());
  }

  Future<void> startJourney() => _action('start-journey');
  Future<void> arrive(String otp) => _action('arrive', {'otp': otp});
  Future<void> hold(String reason) => _action('hold', {'reason': reason});
  Future<void> resume() => _action('resume');
  Future<void> resolve(String note) => _action('resolve', {'note': note});
  Future<void> remoteResolve(String note) => _action('remote-resolve', {'note': note});
  Future<void> cancel(String reason) => _action('cancel', {'reason': reason});
  Future<void> close(String otp) => _action('close', {'otp': otp});
  Future<void> rate(int score, String comment) => _action('rating', {'score': score, 'comment': comment});

  /// Returns true when the part needs the company's approval.
  Future<bool> addPart({required String name, required int qty, required int unitPrice}) async {
    final res = asJson(await ref.read(apiClientProvider).post('$_base/parts', body: {'name': name, 'qty': qty, 'unitPrice': unitPrice}));
    await reload();
    return res.boolean('needsApproval');
  }

  Future<void> uploadPhoto(String kind, String filePath) async {
    await ref.read(apiClientProvider).uploadImage('$_base/media', query: {'kind': kind}, filePath: filePath);
    await reload();
  }
}
