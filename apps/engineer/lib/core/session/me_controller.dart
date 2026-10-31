import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/json.dart';
import '../models/engineer.dart';
import 'session_controller.dart';

final meProvider = AsyncNotifierProvider<MeController, Engineer?>(MeController.new);

/// The signed-in engineer's profile (`GET /engineer/me`). Null when signed out.
class MeController extends AsyncNotifier<Engineer?> {
  @override
  Future<Engineer?> build() async {
    final session = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
    if (session == null) return null;
    return _fetch();
  }

  Future<Engineer> _fetch() async => Engineer.fromJson(asJson(await ref.read(apiClientProvider).get('/engineer/me')));

  /// Refetches; keeps the current profile if the request fails (the error is rethrown).
  Future<void> refresh() async {
    if (ref.read(sessionProvider).valueOrNull == null) return;
    if (state.hasError) state = const AsyncLoading();
    try {
      state = AsyncData(await _fetch());
    } catch (e, st) {
      if (state.valueOrNull == null) state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<void> updateProfile({
    required String name,
    required List<String> skills,
    required int serviceRadiusKm,
    required String employmentType,
  }) async {
    final res = await ref
        .read(apiClientProvider)
        .patch(
          '/engineer/me',
          body: {'name': name, 'skills': skills, 'serviceRadiusKm': serviceRadiusKm, 'employmentType': employmentType},
        );
    state = AsyncData(Engineer.fromJson(asJson(res)));
  }

  /// [at] is required to go online; going offline sends it only if known.
  Future<void> setOnline(bool online, LatLng? at) async {
    final res = await ref
        .read(apiClientProvider)
        .post('/engineer/online', body: {'online': online, if (at != null) 'lat': at.lat, if (at != null) 'lng': at.lng});
    state = AsyncData(Engineer.fromJson(asJson(res)));
  }
}
