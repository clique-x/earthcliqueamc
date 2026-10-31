import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/location/location_service.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/session/permissions_ack.dart';
import '../../core/system/system_channel.dart';
import '../../core/ui/responsive.dart';

class _PermissionState {
  const _PermissionState({required this.location, required this.notifications, required this.fullScreen, required this.battery});
  final bool location;
  final bool notifications;
  final bool fullScreen;
  final bool battery;
}

final _permissionStateProvider = FutureProvider.autoDispose<_PermissionState>((ref) async {
  return _PermissionState(
    location: await LocationService.hasPermission(),
    notifications: await Permission.notification.isGranted,
    fullScreen: await SystemChannel.canUseFullScreenIntent(),
    battery: await Permission.ignoreBatteryOptimizations.isGranted,
  );
});

class PermissionsScreen extends ConsumerStatefulWidget {
  const PermissionsScreen({super.key, this.fromSettings = false});
  final bool fromSettings;

  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    // Settings screens return without a result, so re-check whenever the app comes back.
    _lifecycle = AppLifecycleListener(onResume: () => ref.invalidate(_permissionStateProvider));
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  Future<void> _request(Future<Object?> Function() action) async {
    await action();
    ref.invalidate(_permissionStateProvider);
  }

  Future<void> _continue() async {
    if (widget.fromSettings) {
      context.pop();
      return;
    }
    await ref.read(permissionsAckProvider.notifier).acknowledge();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(_permissionStateProvider).valueOrNull;
    final notifications = ref.read(notificationServiceProvider);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Set up job alerts')),
      body: PageList(
        top: 12,
        children: [
          Text('Allow these so job requests reach you, even when your phone is locked.', style: text.bodyLarge),
          const SizedBox(height: 20),
          _PermissionTile(
            icon: Icons.location_on_outlined,
            title: 'Location',
            body: 'We use your location only while you are online, to find jobs near you and show the company you are on the way.',
            granted: state?.location,
            onRequest: () => _request(LocationService.requestPermission),
          ),
          _PermissionTile(
            icon: Icons.notifications_active_outlined,
            title: 'Notifications',
            body: 'Lets a new job ring your phone like a call.',
            granted: state?.notifications,
            onRequest: () => _request(notifications.requestNotificationPermission),
          ),
          _PermissionTile(
            icon: Icons.fullscreen,
            title: 'Full-screen alerts',
            body: 'Shows the job request over the lock screen; on Android 14+ this opens a setting you need to switch on.',
            granted: state?.fullScreen,
            onRequest: () => _request(notifications.requestFullScreenIntentPermission),
          ),
          _PermissionTile(
            icon: Icons.battery_charging_full,
            title: 'Run in background',
            body: 'Stops the phone from closing the app to save battery, so you don\'t miss jobs while online.',
            granted: state?.battery,
            onRequest: () => _request(Permission.ignoreBatteryOptimizations.request),
          ),
        ],
      ),
      bottomNavigationBar: ActionBar(
        children: [
          if (state != null && !state.location)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('You will need location access to go online.', style: text.bodySmall, textAlign: TextAlign.center),
            ),
          FilledButton(onPressed: _continue, child: Text(widget.fromSettings ? 'Done' : 'Continue')),
        ],
      ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({required this.icon, required this.title, required this.body, required this.granted, required this.onRequest});

  final IconData icon;
  final String title;
  final String body;
  final bool? granted;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 28),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(body),
                    const SizedBox(height: 8),
                    if (granted == true)
                      Row(
                        children: [
                          Icon(Icons.check_circle, color: scheme.primary, size: 18),
                          const SizedBox(width: 6),
                          const Text('Allowed'),
                        ],
                      )
                    else
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                        onPressed: granted == null ? null : onRequest,
                        child: const Text('Allow'),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
