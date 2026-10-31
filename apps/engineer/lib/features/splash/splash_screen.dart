import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/router/app_stage.dart';
import '../../core/session/kyc_controller.dart';
import '../../core/session/me_controller.dart';
import '../../core/session/session_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/responsive.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stage = ref.watch(appStageProvider);
    if (stage != AppStage.error) {
      return const Scaffold(
        body: Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [BrandMark(size: 72), SizedBox(height: 24), CircularProgressIndicator()]),
        ),
      );
    }
    final error = ref.watch(meProvider).error ?? ref.watch(kycProvider).error;
    return Scaffold(
      body: SafeArea(
        child: ContentWidth(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_off, size: 48),
                const SizedBox(height: 16),
                Text(error == null ? 'Could not load your account' : errorMessage(error), textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () {
                    ref.invalidate(meProvider);
                    ref.invalidate(kycProvider);
                  },
                  child: const Text('Try again'),
                ),
                TextButton(onPressed: () => ref.read(sessionProvider.notifier).signOut(), child: const Text('Sign out')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
