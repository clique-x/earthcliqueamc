import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/server_event.dart';

/// Single stream of server events, fed by the WebSocket and by foreground FCM messages.
class EventBus {
  final _controller = StreamController<ServerEvent>.broadcast();

  Stream<ServerEvent> get stream => _controller.stream;

  void add(ServerEvent event) {
    if (!_controller.isClosed) _controller.add(event);
  }

  Future<void> dispose() => _controller.close();
}

final eventBusProvider = Provider<EventBus>((ref) {
  final bus = EventBus();
  ref.onDispose(bus.dispose);
  return bus;
});
