import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../session/kyc_controller.dart';
import '../session/me_controller.dart';
import '../session/permissions_ack.dart';
import '../session/session_controller.dart';

enum AppStage { loading, error, signedOut, profile, kyc, awaitingApproval, permissions, ready }

/// Where the engineer is in the sign-up funnel; drives router redirects.
final appStageProvider = Provider<AppStage>((ref) {
  final session = ref.watch(sessionProvider);
  if (session.isLoading && !session.hasValue) return AppStage.loading;
  if (session.valueOrNull == null) return AppStage.signedOut;

  final me = ref.watch(meProvider);
  final engineer = me.valueOrNull;
  if (engineer == null) return me.hasError ? AppStage.error : AppStage.loading;
  if (!engineer.profileComplete) return AppStage.profile;

  if (!engineer.approved) {
    final kyc = ref.watch(kycProvider);
    final docs = kyc.valueOrNull;
    if (docs == null) return kyc.hasError ? AppStage.error : AppStage.loading;
    return docs.complete ? AppStage.awaitingApproval : AppStage.kyc;
  }

  final ack = ref.watch(permissionsAckProvider).valueOrNull;
  if (ack == null) return AppStage.loading;
  return ack ? AppStage.ready : AppStage.permissions;
});
