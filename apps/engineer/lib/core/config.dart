import 'package:firebase_core/firebase_core.dart';

/// Build-time configuration, passed with `--dart-define`.
abstract final class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

  static const _firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const _firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  static bool get firebaseEnabled =>
      _firebaseApiKey.isNotEmpty && _firebaseAppId.isNotEmpty && _firebaseSenderId.isNotEmpty && _firebaseProjectId.isNotEmpty;

  static FirebaseOptions get firebaseOptions => const FirebaseOptions(
    apiKey: _firebaseApiKey,
    appId: _firebaseAppId,
    messagingSenderId: _firebaseSenderId,
    projectId: _firebaseProjectId,
  );

  static Uri api(String path, [Map<String, String>? query]) {
    final base = Uri.parse(apiUrl);
    final basePath = base.path.endsWith('/') ? base.path.substring(0, base.path.length - 1) : base.path;
    return base.replace(path: '$basePath$path', queryParameters: query);
  }

  static Uri get websocket {
    final uri = api('/ws', {'as': 'engineer'});
    return uri.replace(scheme: uri.scheme == 'https' ? 'wss' : 'ws');
  }
}
