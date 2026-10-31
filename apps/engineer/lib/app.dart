import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_service.dart';
import 'core/realtime/realtime_service.dart';
import 'core/router/app_router.dart';
import 'core/router/app_stage.dart';
import 'core/session/me_controller.dart';
import 'core/theme/app_theme.dart';
import 'core/ui/messenger.dart';
import 'features/home/tracking.dart';
import 'features/jobs/active_job_provider.dart';
import 'features/ring/ring_controller.dart';

class EngineerApp extends ConsumerStatefulWidget {
  const EngineerApp({super.key});

  @override
  ConsumerState<EngineerApp> createState() => _EngineerAppState();
}

class _EngineerAppState extends ConsumerState<EngineerApp> {
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onResume: _onResume);
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  void _onResume() {
    if (ref.read(appStageProvider) != AppStage.ready) {
      unawaited(ref.read(meProvider.notifier).refresh().catchError((Object _) {}));
      return;
    }
    ref.read(realtimeProvider)?.reconnectNow();
    unawaited(ref.read(ringProvider.notifier).checkPending());
    unawaited(ref.read(activeJobProvider.notifier).refresh());
    unawaited(ref.read(meProvider.notifier).refresh().catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final ready = ref.watch(appStageProvider) == AppStage.ready;
    if (ready) {
      // Long-lived services that only make sense for an approved, signed-in engineer.
      ref.watch(realtimeProvider);
      ref.watch(pushRegistrationProvider);
      ref.watch(trackingProvider);
      ref.watch(ringProvider);
    }
    ref.listen(ringProvider, (prev, next) {
      if (next == null || prev?.offerId == next.offerId) return;
      if (router.routerDelegate.currentConfiguration.uri.path != '/ring') router.push('/ring');
    });

    return MaterialApp.router(
      title: 'EarthClique Engineer',
      theme: AppTheme.light(),
      routerConfig: router,
      scaffoldMessengerKey: rootMessengerKey,
      debugShowCheckedModeBanner: false,
    );
  }
}
