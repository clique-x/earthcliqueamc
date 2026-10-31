import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/io.dart';

import '../config.dart';
import '../models/server_event.dart';
import '../session/session_controller.dart';
import 'event_bus.dart';

enum RealtimeStatus { connecting, connected, disconnected }

/// Engineer WebSocket: Bearer header auth, ping every 25 s, reconnect with exponential backoff.
class RealtimeService {
  RealtimeService({required this.token, required this.bus, required this.onRepeatedFailure});

  final String? Function() token;
  final EventBus bus;

  /// Called after a few failed attempts so the app can check whether the session is still valid.
  final VoidCallback onRepeatedFailure;

  final status = ValueNotifier<RealtimeStatus>(RealtimeStatus.disconnected);
  final Set<String> _subscriptions = {};

  IOWebSocketChannel? _channel;
  StreamSubscription<Object?>? _sub;
  Timer? _pingTimer;
  Timer? _retryTimer;
  int _attempt = 0;
  bool _disposed = false;

  void start() => _connect();

  void subscribe(String ticketId) {
    if (_subscriptions.add(ticketId)) _send({'type': 'subscribe', 'ticketId': ticketId});
  }

  void unsubscribe(String ticketId) {
    if (_subscriptions.remove(ticketId)) _send({'type': 'unsubscribe', 'ticketId': ticketId});
  }

  /// Drops the current socket and reconnects immediately (e.g. when the app returns to the foreground).
  void reconnectNow() {
    if (_disposed || status.value == RealtimeStatus.connected) return;
    _retryTimer?.cancel();
    _attempt = 0;
    _connect();
  }

  Future<void> _connect() async {
    if (_disposed) return;
    final t = token();
    if (t == null) return;
    await _teardown();
    if (_disposed) return;
    status.value = RealtimeStatus.connecting;

    final channel = IOWebSocketChannel.connect(
      AppConfig.websocket,
      headers: {'Authorization': 'Bearer $t'},
      connectTimeout: const Duration(seconds: 10),
    );
    _channel = channel;
    try {
      await channel.ready;
    } catch (_) {
      if (_channel == channel) _scheduleReconnect();
      return;
    }
    if (_disposed || _channel != channel) {
      await channel.sink.close();
      return;
    }

    _attempt = 0;
    status.value = RealtimeStatus.connected;
    for (final id in _subscriptions) {
      _send({'type': 'subscribe', 'ticketId': id});
    }
    _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) => _send({'type': 'ping'}));
    _sub = channel.stream.listen(
      (raw) {
        if (raw is! String) return;
        final event = ServerEvent.tryDecode(raw);
        if (event != null && event is! OtherEvent) bus.add(event);
      },
      onDone: () {
        if (_channel == channel) _scheduleReconnect();
      },
      onError: (Object _) {},
      cancelOnError: false,
    );
    bus.add(const ConnectedEvent());
  }

  void _scheduleReconnect() {
    if (_disposed) return;
    _pingTimer?.cancel();
    status.value = RealtimeStatus.disconnected;
    _attempt++;
    if (_attempt % 3 == 0) onRepeatedFailure();
    final seconds = min(30, pow(2, min(_attempt, 5)).toInt());
    final jitter = Random().nextInt(1000);
    _retryTimer?.cancel();
    _retryTimer = Timer(Duration(seconds: seconds, milliseconds: jitter), _connect);
  }

  void _send(Map<String, Object?> message) {
    if (status.value != RealtimeStatus.connected) return;
    _channel?.sink.add(jsonEncode(message));
  }

  Future<void> _teardown() async {
    _pingTimer?.cancel();
    await _sub?.cancel();
    _sub = null;
    final old = _channel;
    _channel = null;
    await old?.sink.close();
  }

  Future<void> dispose() async {
    _disposed = true;
    _retryTimer?.cancel();
    await _teardown();
    status.dispose();
  }
}

/// Lives while signed in; a new token (re-login) creates a fresh connection.
final realtimeProvider = Provider<RealtimeService?>((ref) {
  final token = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
  if (token == null) return null;
  final service = RealtimeService(
    token: () => ref.read(sessionProvider).valueOrNull?.token,
    bus: ref.read(eventBusProvider),
    // Any authenticated call that returns 401 signs the engineer out.
    onRepeatedFailure: () => ref.read(apiClientProvider).get('/engineer/me').ignore(),
  )..start();
  ref.onDispose(service.dispose);
  return service;
});
