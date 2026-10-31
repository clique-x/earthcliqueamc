import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/json.dart';
import '../../core/models/ring_offer.dart';
import '../../core/models/server_event.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/realtime/event_bus.dart';
import '../../core/session/session_controller.dart';
import '../jobs/active_job_provider.dart';

final ringProvider = NotifierProvider<RingController, RingOffer?>(RingController.new);

/// The job request currently ringing on this phone, if any.
class RingController extends Notifier<RingOffer?> {
  final Set<String> _handled = {};
  Timer? _expiry;

  NotificationService get _notifications => ref.read(notificationServiceProvider);

  @override
  RingOffer? build() {
    final token = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
    ref.onDispose(() => _expiry?.cancel());
    if (token == null) return null;

    final notifications = ref.read(notificationServiceProvider);
    final subs = <StreamSubscription<Object?>>[
      ref.read(eventBusProvider).stream.listen(_onEvent),
      notifications.taps.listen(_onNotificationPayload),
    ];
    ref.onDispose(() {
      for (final s in subs) {
        s.cancel();
      }
    });
    final launch = notifications.launchPayload;
    if (launch != null) {
      notifications.launchPayload = null;
      Future.microtask(() => _onNotificationPayload(launch));
    }
    Future.microtask(checkPending);
    return null;
  }

  void _onEvent(ServerEvent event) {
    switch (event) {
      case RingEvent(:final ring):
        offer(ring);
      case RingCancelEvent(:final offerId):
        _handled.add(offerId);
        _clear(offerId);
      case ConnectedEvent():
        unawaited(checkPending());
      case TicketUpdatedEvent() || OtherEvent():
        break;
    }
  }

  void _onNotificationPayload(String payload) {
    try {
      final ring = RingOffer.fromJson(asJson(jsonDecode(payload)));
      if (ring.offerId.isNotEmpty) offer(ring);
    } on FormatException {
      // Not a ring notification.
    }
    unawaited(checkPending());
  }

  void offer(RingOffer ring) {
    if (_handled.contains(ring.offerId) || ring.isExpired) {
      unawaited(_notifications.cancelRing(ring.offerId));
      return;
    }
    if (state?.offerId == ring.offerId) return;
    state = ring;
    unawaited(_notifications.showRing(ring));
    _expiry?.cancel();
    _expiry = Timer(ring.expiresAt.difference(DateTime.now()), () => _clear(ring.offerId));
  }

  /// Shows any ring still open on the server (app opened from a notification, or resumed).
  Future<void> checkPending() async {
    if (ref.read(sessionProvider).valueOrNull == null) return;
    try {
      final res = await ref.read(apiClientProvider).get('/engineer/offers/pending');
      final offers = asJsonList(res).map(RingOffer.fromJson).where((r) => !r.isExpired).toList();
      final current = state;
      if (current != null && !offers.any((o) => o.offerId == current.offerId)) _clear(current.offerId);
      if (offers.isNotEmpty && state == null) offer(offers.first);
    } catch (e) {
      debugPrint('[ring] pending check failed: $e');
    }
  }

  /// Returns the ticket id. Throws ApiException (409 "Another engineer took this job") on a lost race.
  Future<String> accept() async {
    final ring = state;
    if (ring == null) throw StateError('No ring');
    _handled.add(ring.offerId);
    try {
      final res = asJson(await ref.read(apiClientProvider).post('/engineer/offers/${ring.offerId}/accept'));
      unawaited(ref.read(activeJobProvider.notifier).refresh());
      return res.str('ticketId', ring.ticketId);
    } finally {
      _clear(ring.offerId);
    }
  }

  Future<void> decline() async {
    final ring = state;
    if (ring == null) return;
    _handled.add(ring.offerId);
    _clear(ring.offerId);
    try {
      await ref.read(apiClientProvider).post('/engineer/offers/${ring.offerId}/decline');
    } catch (e) {
      debugPrint('[ring] decline failed: $e');
    }
  }

  void _clear(String offerId) {
    unawaited(_notifications.cancelRing(offerId));
    if (state?.offerId == offerId) {
      _expiry?.cancel();
      state = null;
    }
  }
}
