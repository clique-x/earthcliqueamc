import '../api/json.dart';

enum EngineerStatus { pending, approved, rejected, suspended }

class LatLng {
  const LatLng(this.lat, this.lng);
  final double lat;
  final double lng;
}

class Engineer {
  const Engineer({
    required this.id,
    required this.phone,
    required this.name,
    required this.status,
    required this.rejectionReason,
    required this.employmentType,
    required this.skills,
    required this.serviceRadiusKm,
    required this.isOnline,
    required this.ratingAvg,
    required this.ratingCount,
    required this.cooldownUntil,
    required this.lastLocation,
  });

  factory Engineer.fromJson(Json j) {
    final loc = j.objOrNull('lastLocation');
    return Engineer(
      id: j.str('id'),
      phone: j.str('phone'),
      name: j.str('name'),
      status: EngineerStatus.values.where((s) => s.name == j.str('status')).firstOrNull ?? EngineerStatus.pending,
      rejectionReason: j.strOrNull('rejectionReason'),
      employmentType: j.str('employmentType', 'freelance'),
      skills: j.strList('skills'),
      serviceRadiusKm: j.integer('serviceRadiusKm', 10),
      isOnline: j.boolean('isOnline'),
      ratingAvg: j.dbl('ratingAvg'),
      ratingCount: j.integer('ratingCount'),
      cooldownUntil: j.date('cooldownUntil'),
      lastLocation: loc == null ? null : LatLng(loc.dbl('lat'), loc.dbl('lng')),
    );
  }

  final String id;
  final String phone;
  final String name;
  final EngineerStatus status;
  final String? rejectionReason;
  final String employmentType;
  final List<String> skills;
  final int serviceRadiusKm;
  final bool isOnline;
  final double ratingAvg;
  final int ratingCount;
  final DateTime? cooldownUntil;
  final LatLng? lastLocation;

  bool get profileComplete => name.trim().isNotEmpty && skills.isNotEmpty;
  bool get approved => status == EngineerStatus.approved;
  bool get inCooldown => cooldownUntil != null && cooldownUntil!.isAfter(DateTime.now());
}

class KycDoc {
  const KycDoc({required this.id, required this.docType, required this.verified});

  factory KycDoc.fromJson(Json j) => KycDoc(id: j.str('id'), docType: j.str('docType'), verified: j.boolean('verified'));

  final String id;
  final String docType;
  final bool verified;
}
