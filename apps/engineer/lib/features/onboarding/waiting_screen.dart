import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/engineer.dart';
import '../../core/session/kyc_controller.dart';
import '../../core/session/me_controller.dart';
import '../../core/session/session_controller.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';

class WaitingScreen extends ConsumerWidget {
  const WaitingScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    try {
      await ref.read(meProvider.notifier).refresh();
      ref.invalidate(kycProvider);
    } catch (e) {
      showError(e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull;
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final (icon, title, body) = switch (me?.status) {
      EngineerStatus.rejected => (
        Icons.cancel_outlined,
        'Application not approved',
        me?.rejectionReason?.isNotEmpty == true ? me!.rejectionReason! : 'Please contact EarthClique support.',
      ),
      EngineerStatus.suspended => (Icons.block, 'Account suspended', 'Please contact EarthClique support.'),
      _ => (
        Icons.hourglass_top,
        'Waiting for approval',
        'Our team is checking your documents. You will be able to go online once approved. Pull down to check again.',
      ),
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text('EarthClique Engineer'),
        actions: [TextButton(onPressed: () => ref.read(sessionProvider.notifier).signOut(), child: const Text('Sign out'))],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: PageList(
          top: 24,
          children: [
            const SizedBox(height: 32),
            Icon(icon, size: 72, color: me?.status == EngineerStatus.pending ? scheme.primary : scheme.error),
            const SizedBox(height: 16),
            Text(title, style: text.headlineSmall, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(body, style: text.bodyLarge, textAlign: TextAlign.center),
            const SizedBox(height: 32),
            if (me != null)
              Card(
                child: Column(
                  children: [
                    ListTile(leading: const Icon(Icons.person_outline), title: Text(me.name), subtitle: Text('+91 ${me.phone}')),
                    ListTile(
                      leading: const Icon(Icons.edit_outlined),
                      title: const Text('Edit profile'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/onboarding/waiting/profile'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.description_outlined),
                      title: const Text('Update documents'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/onboarding/waiting/kyc'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
