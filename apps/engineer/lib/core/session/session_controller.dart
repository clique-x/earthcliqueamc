import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_client.dart';
import '../api/json.dart';

class Session {
  const Session({required this.token, required this.engineerId});
  final String token;
  final String engineerId;
}

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) => const FlutterSecureStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    token: () => ref.read(sessionProvider).valueOrNull?.token,
    onUnauthorized: () => ref.read(sessionProvider.notifier).signOut(),
  );
});

final sessionProvider = AsyncNotifierProvider<SessionController, Session?>(SessionController.new);

class SessionController extends AsyncNotifier<Session?> {
  static const _tokenKey = 'auth_token';
  static const _engineerKey = 'engineer_id';

  FlutterSecureStorage get _storage => ref.read(secureStorageProvider);

  @override
  Future<Session?> build() async {
    final token = await _storage.read(key: _tokenKey);
    final id = await _storage.read(key: _engineerKey);
    if (token == null || id == null) return null;
    return Session(token: token, engineerId: id);
  }

  /// Returns the dev OTP when the API runs in development mode.
  Future<String?> requestOtp(String phone) async {
    final res = asJson(await ref.read(apiClientProvider).post('/auth/engineer/otp/request', body: {'phone': phone}));
    return res.strOrNull('devCode');
  }

  Future<void> verifyOtp(String phone, String code) async {
    final res = asJson(await ref.read(apiClientProvider).post('/auth/engineer/otp/verify', body: {'phone': phone, 'code': code}));
    final session = Session(token: res.str('token'), engineerId: res.obj('engineer').str('id'));
    await _storage.write(key: _tokenKey, value: session.token);
    await _storage.write(key: _engineerKey, value: session.engineerId);
    state = AsyncData(session);
  }

  Future<void> signOut() async {
    if (state.valueOrNull == null) return;
    state = const AsyncData(null);
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _engineerKey);
  }
}
