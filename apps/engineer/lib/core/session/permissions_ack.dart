import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'session_controller.dart';

final permissionsAckProvider = AsyncNotifierProvider<PermissionsAckController, bool>(PermissionsAckController.new);

/// Whether the engineer has been through the permissions step once on this device.
class PermissionsAckController extends AsyncNotifier<bool> {
  static const _key = 'permissions_seen';

  @override
  Future<bool> build() async => await ref.read(secureStorageProvider).read(key: _key) == '1';

  Future<void> acknowledge() async {
    await ref.read(secureStorageProvider).write(key: _key, value: '1');
    state = const AsyncData(true);
  }
}
