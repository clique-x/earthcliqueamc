typedef Json = Map<String, Object?>;

Json asJson(Object? value) => value is Map ? value.cast<String, Object?>() : const {};

List<Json> asJsonList(Object? value) => value is List ? value.map(asJson).toList() : const [];

extension JsonRead on Json {
  String str(String key, [String fallback = '']) {
    final v = this[key];
    return v is String ? v : (v == null ? fallback : v.toString());
  }

  String? strOrNull(String key) {
    final v = this[key];
    return v is String ? v : null;
  }

  int integer(String key, [int fallback = 0]) {
    final v = this[key];
    return v is num ? v.toInt() : fallback;
  }

  int? intOrNull(String key) {
    final v = this[key];
    return v is num ? v.toInt() : null;
  }

  double dbl(String key, [double fallback = 0]) {
    final v = this[key];
    return v is num ? v.toDouble() : fallback;
  }

  bool boolean(String key, [bool fallback = false]) {
    final v = this[key];
    return v is bool ? v : fallback;
  }

  DateTime? date(String key) {
    final v = this[key];
    return v is String ? DateTime.tryParse(v)?.toLocal() : null;
  }

  Json obj(String key) => asJson(this[key]);

  Json? objOrNull(String key) => this[key] is Map ? asJson(this[key]) : null;

  List<Json> objList(String key) => asJsonList(this[key]);

  List<String> strList(String key) {
    final v = this[key];
    return v is List ? v.whereType<String>().toList() : const [];
  }

  Map<String, String> strMap(String key) {
    final v = this[key];
    if (v is! Map) return const {};
    return {for (final e in v.entries) e.key.toString(): e.value?.toString() ?? ''};
  }
}
