import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/login_screen.dart';
import '../../features/auth/otp_screen.dart';
import '../../features/earnings/earnings_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/jobs/history_screen.dart';
import '../../features/jobs/job_screen.dart';
import '../../features/onboarding/kyc_screen.dart';
import '../../features/onboarding/permissions_screen.dart';
import '../../features/onboarding/profile_screen.dart';
import '../../features/onboarding/waiting_screen.dart';
import '../../features/ring/ring_screen.dart';
import '../../features/splash/splash_screen.dart';
import 'app_stage.dart';

/// Each sign-up stage owns one location (plus its sub-routes); once ready, the main app is open.
String? _redirect(AppStage stage, String location) {
  bool under(String root) => location == root || location.startsWith('$root/');
  String? only(String root) => under(root) ? null : root;

  return switch (stage) {
    AppStage.loading || AppStage.error => only('/splash'),
    AppStage.signedOut => only('/login'),
    AppStage.profile => only('/onboarding/profile'),
    AppStage.kyc => only('/onboarding/kyc'),
    AppStage.awaitingApproval => only('/onboarding/waiting'),
    AppStage.permissions => only('/permissions'),
    AppStage.ready => under('/splash') || under('/login') || under('/onboarding') || under('/permissions') ? '/home' : null,
  };
}

final routerProvider = Provider<GoRouter>((ref) {
  final stage = ValueNotifier<AppStage>(ref.read(appStageProvider));
  ref.listen(appStageProvider, (_, next) => stage.value = next);
  ref.onDispose(stage.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: stage,
    redirect: (context, state) => _redirect(stage.value, state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: '/login',
        builder: (_, _) => const LoginScreen(),
        routes: [
          GoRoute(
            path: 'otp',
            redirect: (_, state) => state.extra is OtpArgs ? null : '/login',
            builder: (_, state) => OtpScreen(args: state.extra! as OtpArgs),
          ),
        ],
      ),
      GoRoute(path: '/onboarding/profile', builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/onboarding/kyc', builder: (_, _) => const KycScreen()),
      GoRoute(
        path: '/onboarding/waiting',
        builder: (_, _) => const WaitingScreen(),
        routes: [
          GoRoute(path: 'profile', builder: (_, _) => const ProfileScreen(editing: true)),
          GoRoute(path: 'kyc', builder: (_, _) => const KycScreen(editing: true)),
        ],
      ),
      GoRoute(path: '/permissions', builder: (_, _) => const PermissionsScreen()),
      GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
      GoRoute(path: '/settings/permissions', builder: (_, _) => const PermissionsScreen(fromSettings: true)),
      GoRoute(path: '/ring', builder: (_, _) => const RingScreen()),
      GoRoute(
        path: '/job/:id',
        builder: (_, state) => JobScreen(jobId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/history', builder: (_, _) => const HistoryScreen()),
      GoRoute(path: '/earnings', builder: (_, _) => const EarningsScreen()),
    ],
  );
});
