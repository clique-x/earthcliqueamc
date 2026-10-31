import 'package:flutter/services.dart';

/// Small platform calls implemented in MainActivity.kt.
abstract final class SystemChannel {
  static const _channel = MethodChannel('amc/system');

  /// Android 14+ can revoke full-screen intents; older versions always allow them.
  static Future<bool> canUseFullScreenIntent() async {
    try {
      return await _channel.invokeMethod<bool>('canUseFullScreenIntent') ?? true;
    } on PlatformException {
      return true;
    } on MissingPluginException {
      return true;
    }
  }
}
