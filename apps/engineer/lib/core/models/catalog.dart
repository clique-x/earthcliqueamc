/// Mirrors packages/shared: categories, triage question labels and ticket statuses.
enum Category {
  pc('Windows / PC'),
  network('Network / Internet'),
  cctv('CCTV');

  const Category(this.label);
  final String label;

  static Category? parse(String value) => Category.values.where((c) => c.name == value).firstOrNull;
}

String categoryLabel(String value) => Category.parse(value)?.label ?? value;

const Map<String, Map<String, String>> _triageLabels = {
  'pc': {'symptom': 'What is happening?', 'machines': 'Machines affected', 'os': 'Operating system', 'recent_change': 'Recent changes'},
  'network': {'symptom': 'What is happening?', 'isp_checked': 'Checked with internet provider?', 'lights': 'Router lights'},
  'cctv': {'symptom': 'What is happening?', 'camera_count': 'Cameras affected', 'recorder': 'Recorder brand'},
};

String triageLabel(String category, String questionId) => _triageLabels[category]?[questionId] ?? questionId;

enum TicketStatus {
  open('Open'),
  searching('Finding engineer'),
  unassigned('No engineer found'),
  assigned('Assigned to you'),
  enRoute('On the way'),
  arrived('Arrived'),
  inProgress('Work in progress'),
  onHold('On hold'),
  resolved('Resolved — awaiting close OTP'),
  remoteResolved('Fixed remotely — awaiting confirmation'),
  closed('Closed'),
  cancelled('Cancelled'),
  unknown('Unknown');

  const TicketStatus(this.label);
  final String label;

  static TicketStatus parse(String value) => switch (value) {
    'OPEN' => open,
    'SEARCHING' => searching,
    'UNASSIGNED' => unassigned,
    'ASSIGNED' => assigned,
    'EN_ROUTE' => enRoute,
    'ARRIVED' => arrived,
    'IN_PROGRESS' => inProgress,
    'ON_HOLD' => onHold,
    'RESOLVED' => resolved,
    'REMOTE_RESOLVED' => remoteResolved,
    'CLOSED' => closed,
    'CANCELLED' => cancelled,
    _ => unknown,
  };

  bool get isActive => const {assigned, enRoute, arrived, inProgress, onHold}.contains(this);
}
