import '../api/json.dart';

/// Mirrors RingPayload in packages/shared/src/events.ts.
class RingOffer {
  const RingOffer({
    required this.offerId,
    required this.ticketId,
    required this.code,
    required this.category,
    required this.priority,
    required this.title,
    required this.distanceKm,
    required this.feeEstimate,
    required this.expiresAt,
    required this.triage,
  });

  factory RingOffer.fromJson(Json j) => RingOffer(
    offerId: j.str('offerId'),
    ticketId: j.str('ticketId'),
    code: j.str('code'),
    category: j.str('category'),
    priority: j.str('priority', 'normal'),
    title: j.str('title'),
    distanceKm: j.dbl('distanceKm'),
    feeEstimate: j.integer('feeEstimate'),
    expiresAt: j.date('expiresAt') ?? DateTime.now(),
    triage: j.strMap('triage'),
  );

  final String offerId;
  final String ticketId;
  final String code;
  final String category;
  final String priority;
  final String title;
  final double distanceKm;
  final int feeEstimate;
  final DateTime expiresAt;
  final Map<String, String> triage;

  bool get isUrgent => priority == 'urgent';
  bool get isExpired => DateTime.now().isAfter(expiresAt);

  Json toJson() => {
    'offerId': offerId,
    'ticketId': ticketId,
    'code': code,
    'category': category,
    'priority': priority,
    'title': title,
    'distanceKm': distanceKm,
    'feeEstimate': feeEstimate,
    'expiresAt': expiresAt.toUtc().toIso8601String(),
    'triage': triage,
  };
}
