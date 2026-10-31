import '../api/json.dart';
import 'catalog.dart';

class JobSummary {
  const JobSummary({
    required this.id,
    required this.code,
    required this.category,
    required this.priority,
    required this.title,
    required this.status,
    required this.feeEstimate,
    required this.feeFinal,
    required this.assignedAt,
    required this.closedAt,
    required this.siteLabel,
    required this.siteAddress,
  });

  factory JobSummary.fromJson(Json j) => JobSummary(
    id: j.str('id'),
    code: j.str('code'),
    category: j.str('category'),
    priority: j.str('priority', 'normal'),
    title: j.str('title'),
    status: TicketStatus.parse(j.str('status')),
    feeEstimate: j.integer('feeEstimate'),
    feeFinal: j.intOrNull('feeFinal'),
    assignedAt: j.date('assignedAt'),
    closedAt: j.date('closedAt'),
    siteLabel: j.str('siteLabel'),
    siteAddress: j.str('siteAddress'),
  );

  final String id;
  final String code;
  final String category;
  final String priority;
  final String title;
  final TicketStatus status;
  final int feeEstimate;
  final int? feeFinal;
  final DateTime? assignedAt;
  final DateTime? closedAt;
  final String siteLabel;
  final String siteAddress;
}

class JobSite {
  const JobSite({
    required this.label,
    required this.address,
    required this.lat,
    required this.lng,
    required this.contactName,
    required this.contactPhone,
  });

  factory JobSite.fromJson(Json j) => JobSite(
    label: j.str('label'),
    address: j.str('address'),
    lat: j.dbl('lat'),
    lng: j.dbl('lng'),
    contactName: j.str('contactName'),
    contactPhone: j.str('contactPhone'),
  );

  final String label;
  final String address;
  final double lat;
  final double lng;
  final String contactName;
  final String contactPhone;
}

class JobMedia {
  const JobMedia({required this.id, required this.kind, required this.url});

  factory JobMedia.fromJson(Json j) => JobMedia(id: j.str('id'), kind: j.str('kind'), url: j.str('url'));

  final String id;
  final String kind;
  final String url;
}

enum PartStatus { approved, pending, rejected }

class JobPart {
  const JobPart({required this.id, required this.name, required this.qty, required this.unitPrice, required this.status});

  factory JobPart.fromJson(Json j) => JobPart(
    id: j.str('id'),
    name: j.str('name'),
    qty: j.integer('qty', 1),
    unitPrice: j.integer('unitPrice'),
    status: PartStatus.values.where((s) => s.name == j.str('status')).firstOrNull ?? PartStatus.pending,
  );

  final String id;
  final String name;
  final int qty;
  final int unitPrice;
  final PartStatus status;

  int get total => qty * unitPrice;
}

class JobEvent {
  const JobEvent({required this.toStatus, required this.note, required this.createdAt});

  factory JobEvent.fromJson(Json j) =>
      JobEvent(toStatus: j.strOrNull('toStatus'), note: j.strOrNull('note'), createdAt: j.date('createdAt'));

  final String? toStatus;
  final String? note;
  final DateTime? createdAt;

  String get text => note ?? (toStatus == null ? '' : TicketStatus.parse(toStatus!).label);
}

class JobDetail {
  const JobDetail({
    required this.id,
    required this.code,
    required this.category,
    required this.priority,
    required this.title,
    required this.description,
    required this.status,
    required this.feeEstimate,
    required this.feeFinal,
    required this.triage,
    required this.companyName,
    required this.site,
    required this.media,
    required this.parts,
    required this.events,
    required this.ratedByEngineer,
  });

  factory JobDetail.fromJson(Json j) => JobDetail(
    id: j.str('id'),
    code: j.str('code'),
    category: j.str('category'),
    priority: j.str('priority', 'normal'),
    title: j.str('title'),
    description: j.str('description'),
    status: TicketStatus.parse(j.str('status')),
    feeEstimate: j.integer('feeEstimate'),
    feeFinal: j.intOrNull('feeFinal'),
    triage: j.strMap('triage'),
    companyName: j.objOrNull('company')?.str('name') ?? '',
    site: j.objOrNull('site') == null ? null : JobSite.fromJson(j.obj('site')),
    media: j.objList('media').map(JobMedia.fromJson).toList(),
    parts: j.objList('parts').map(JobPart.fromJson).toList(),
    events: j.objList('events').map(JobEvent.fromJson).toList(),
    ratedByEngineer: j.objList('ratings').any((r) => r.str('fromType') == 'engineer'),
  );

  final String id;
  final String code;
  final String category;
  final String priority;
  final String title;
  final String description;
  final TicketStatus status;
  final int feeEstimate;
  final int? feeFinal;
  final Map<String, String> triage;
  final String companyName;
  final JobSite? site;
  final List<JobMedia> media;
  final List<JobPart> parts;
  final List<JobEvent> events;
  final bool ratedByEngineer;

  List<JobMedia> mediaOf(String kind) => media.where((m) => m.kind == kind).toList();
}
