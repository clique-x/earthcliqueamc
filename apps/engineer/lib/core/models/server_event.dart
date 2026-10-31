import 'dart:convert';

import '../api/json.dart';
import 'catalog.dart';
import 'ring_offer.dart';

/// Events from the API (WebSocket or FCM data message), plus a client-side "connected" marker.
sealed class ServerEvent {
  const ServerEvent();

  static ServerEvent parse(Json j) => switch (j.str('type')) {
    'ring' => RingEvent(RingOffer.fromJson(j.obj('ring'))),
    'ring.cancel' => RingCancelEvent(offerId: j.str('offerId'), ticketId: j.str('ticketId'), reason: j.str('reason')),
    'ticket.updated' => TicketUpdatedEvent(ticketId: j.str('ticketId'), status: TicketStatus.parse(j.str('status'))),
    final other => OtherEvent(other),
  };

  static ServerEvent? tryDecode(String raw) {
    try {
      return parse(asJson(jsonDecode(raw)));
    } on FormatException {
      return null;
    }
  }

  /// FCM data message: `{ type, payload: JSON.stringify(event) }`.
  static ServerEvent? fromPush(Map<String, Object?> data) {
    final payload = data['payload'];
    return payload is String ? tryDecode(payload) : null;
  }
}

class RingEvent extends ServerEvent {
  const RingEvent(this.ring);
  final RingOffer ring;
}

class RingCancelEvent extends ServerEvent {
  const RingCancelEvent({required this.offerId, required this.ticketId, required this.reason});
  final String offerId;
  final String ticketId;
  final String reason;
}

class TicketUpdatedEvent extends ServerEvent {
  const TicketUpdatedEvent({required this.ticketId, required this.status});
  final String ticketId;
  final TicketStatus status;
}

/// Emitted locally each time the WebSocket (re)connects, so screens can refetch anything missed.
class ConnectedEvent extends ServerEvent {
  const ConnectedEvent();
}

class OtherEvent extends ServerEvent {
  const OtherEvent(this.type);
  final String type;
}
