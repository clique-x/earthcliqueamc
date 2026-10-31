import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/json.dart';
import '../../core/models/earnings.dart';
import '../../core/session/session_controller.dart';

final earningsProvider = FutureProvider.autoDispose<Earnings>((ref) async {
  return Earnings.fromJson(asJson(await ref.watch(apiClientProvider).get('/engineer/earnings')));
});
