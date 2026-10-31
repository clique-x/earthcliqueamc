import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/catalog.dart';
import '../../core/models/engineer.dart';
import '../../core/models/job.dart';
import '../../core/realtime/realtime_service.dart';
import '../../core/session/me_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/format.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/status_chip.dart';
import '../earnings/earnings_provider.dart';
import '../jobs/active_job_provider.dart';
import 'online_actions.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(earningsProvider);
    await Future.wait([ref.read(meProvider.notifier).refresh().catchError(showError), ref.read(activeJobProvider.notifier).refresh()]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull;
    final activeJob = ref.watch(activeJobProvider).valueOrNull;
    if (me == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Hi, ${me.name.split(' ').first}', style: text.headlineSmall),
            if (me.ratingCount > 0)
              Row(
                children: [
                  const Icon(Icons.star_rounded, size: 16, color: AppColors.warning),
                  const SizedBox(width: 4),
                  Text(
                    '${me.ratingAvg.toStringAsFixed(1)} · ${me.ratingCount} rating${me.ratingCount == 1 ? '' : 's'}',
                    style: text.bodySmall,
                  ),
                ],
              ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'More',
            onSelected: (v) {
              if (v == 'permissions') context.push('/settings/permissions');
              if (v == 'signout') signOut(ref);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'permissions', child: Text('Alerts & permissions')),
              PopupMenuItem(value: 'signout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _refresh(ref),
        child: PageList(
          children: [
            // The current job comes first: it's what the engineer needs most when one is open.
            if (activeJob != null) ...[_ActiveJobCard(job: activeJob), const SizedBox(height: 16)],
            _OnlineToggle(engineer: me),
            if (me.inCooldown) ...[
              const SizedBox(height: 12),
              _Notice(
                icon: Icons.timer_outlined,
                title: 'New jobs paused',
                body: 'Because of recent cancellations, you will get new jobs again after ${dateTime(me.cooldownUntil)}.',
              ),
            ],
            const SizedBox(height: 16),
            const _EarningsSummary(),
            const SizedBox(height: 16),
            Card(
              child: Column(
                children: [
                  _LinkTile(icon: Icons.history, label: 'Job history', onTap: () => context.push('/history')),
                  const Divider(height: 1, indent: 56),
                  _LinkTile(icon: Icons.account_balance_wallet_outlined, label: 'Earnings', onTap: () => context.push('/earnings')),
                  const Divider(height: 1, indent: 56),
                  _LinkTile(
                    icon: Icons.notifications_active_outlined,
                    label: 'Alerts & permissions',
                    onTap: () => context.push('/settings/permissions'),
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

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(leading: Icon(icon), title: Text(label), trailing: const Icon(Icons.chevron_right), onTap: onTap);
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: AppColors.warning.withValues(alpha: 0.12),
      child: ListTile(
        leading: Icon(icon, color: AppColors.warning),
        title: Text(title),
        subtitle: Text(body),
      ),
    );
  }
}

class _OnlineToggle extends ConsumerStatefulWidget {
  const _OnlineToggle({required this.engineer});
  final Engineer engineer;

  @override
  ConsumerState<_OnlineToggle> createState() => _OnlineToggleState();
}

class _OnlineToggleState extends ConsumerState<_OnlineToggle> {
  bool _busy = false;

  Future<void> _toggle() async {
    HapticFeedback.mediumImpact();
    setState(() => _busy = true);
    try {
      await setOnline(ref, !widget.engineer.isOnline);
    } catch (e) {
      showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final online = widget.engineer.isOnline;
    final text = Theme.of(context).textTheme;
    final short = Layout.isShort(context);
    final diameter = short ? 104.0 : math.min(168.0, MediaQuery.sizeOf(context).width * 0.42);

    final button = Semantics(
      button: true,
      toggled: online,
      label: online ? 'You are online. Tap to go offline.' : 'You are offline. Tap to go online.',
      excludeSemantics: true,
      child: _PowerButton(online: online, busy: _busy, diameter: diameter, onTap: _busy ? null : _toggle),
    );
    final caption = Column(
      crossAxisAlignment: short ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      children: [
        Text(online ? 'You\'re online' : 'You\'re offline', style: text.titleLarge),
        const SizedBox(height: 4),
        Text(
          online ? 'Job requests near you will ring this phone.' : 'Go online to start receiving job requests.',
          textAlign: short ? TextAlign.start : TextAlign.center,
        ),
        if (online) ...[
          const SizedBox(height: 4),
          Text(
            'Location is shared only while you are online.',
            style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
            textAlign: short ? TextAlign.start : TextAlign.center,
          ),
        ],
        const _ConnectionNotice(),
      ],
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: short
            ? Row(
                children: [
                  button,
                  const SizedBox(width: 20),
                  Expanded(child: caption),
                ],
              )
            : Column(children: [button, const SizedBox(height: 16), caption]),
      ),
    );
  }
}

class _PowerButton extends StatelessWidget {
  const _PowerButton({required this.online, required this.busy, required this.diameter, required this.onTap});
  final bool online;
  final bool busy;
  final double diameter;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = online ? AppColors.online : AppColors.offline;
    return Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: diameter,
          height: diameter,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: online ? 0.45 : 0.2),
                blurRadius: online ? 28 : 12,
                spreadRadius: online ? 2 : 0,
              ),
            ],
          ),
          child: Center(
            child: busy
                ? const CircularProgressIndicator(color: AppColors.onRing)
                : FittedBox(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.power_settings_new, size: 44, color: AppColors.onRing),
                          const SizedBox(height: 4),
                          Text(
                            online ? 'ONLINE' : 'OFFLINE',
                            style: Theme.of(
                              context,
                            ).textTheme.titleLarge?.copyWith(color: AppColors.onRing, fontWeight: FontWeight.w800, letterSpacing: 1),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _ConnectionNotice extends ConsumerWidget {
  const _ConnectionNotice();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final realtime = ref.watch(realtimeProvider);
    final online = ref.watch(meProvider.select((m) => m.valueOrNull?.isOnline ?? false));
    if (realtime == null || !online) return const SizedBox.shrink();
    return ValueListenableBuilder<RealtimeStatus>(
      valueListenable: realtime.status,
      builder: (context, status, _) => status == RealtimeStatus.connected
          ? const SizedBox.shrink()
          : Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Pill(label: 'Connecting to job server…', color: AppColors.warning, icon: Icons.sync),
            ),
    );
  }
}

class _ActiveJobCard extends StatelessWidget {
  const _ActiveJobCard({required this.job});
  final JobSummary job;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final onCard = scheme.onSurface;
    return Card(
      color: AppTheme.brandTint(scheme),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radius), side: AppTheme.brandBorder(scheme)),
      child: InkWell(
        onTap: () => context.push('/job/${job.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'CURRENT JOB',
                      style: text.labelMedium?.copyWith(color: scheme.primary, fontWeight: FontWeight.w700, letterSpacing: 1.1),
                    ),
                  ),
                  StatusChip(job.status),
                ],
              ),
              const SizedBox(height: 10),
              Text(job.title, style: text.titleLarge?.copyWith(color: onCard)),
              const SizedBox(height: 4),
              Text(
                '${job.code} · ${categoryLabel(job.category)} · ${job.siteLabel}',
                style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
              ),
              const SizedBox(height: 14),
              JobProgress(status: job.status),
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: () => context.push('/job/${job.id}'),
                icon: const Icon(Icons.arrow_forward),
                label: const Text('Open job'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EarningsSummary extends ConsumerWidget {
  const _EarningsSummary();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earnings = ref.watch(earningsProvider).valueOrNull;
    final text = Theme.of(context).textTheme;
    final muted = text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    Widget cell(String label, int? amount) => Expanded(
      child: Column(
        children: [
          // Large amounts or text sizes shrink to fit rather than overflow.
          FittedBox(child: Text(amount == null ? '—' : rupees(amount), style: text.titleLarge)),
          const SizedBox(height: 2),
          Text(label, style: muted, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
    return Card(
      child: InkWell(
        onTap: () => context.push('/earnings'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          child: Column(
            children: [
              Text('Job value', style: muted),
              const SizedBox(height: 8),
              Row(
                children: [
                  cell('Today', earnings?.today.amount),
                  cell('This week', earnings?.week.amount),
                  cell('This month', earnings?.month.amount),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
