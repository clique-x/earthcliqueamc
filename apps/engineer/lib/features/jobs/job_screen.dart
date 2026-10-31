import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/catalog.dart';
import '../../core/models/job.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/authed_image.dart';
import '../../core/ui/busy_button.dart';
import '../../core/ui/dialogs.dart';
import '../../core/ui/format.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/status_chip.dart';
import 'job_controller.dart';
import 'job_dialogs.dart';

class JobScreen extends ConsumerWidget {
  const JobScreen({super.key, required this.jobId});
  final String jobId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final job = ref.watch(jobProvider(jobId));
    final loaded = job.valueOrNull;
    return Scaffold(
      appBar: AppBar(title: Text(loaded?.code ?? 'Job')),
      body: job.when(
        skipLoadingOnReload: true,
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _JobError(message: errorMessage(e), onRetry: () => ref.invalidate(jobProvider(jobId))),
        data: (j) => RefreshIndicator(
          onRefresh: () => ref.read(jobProvider(jobId).notifier).reload(),
          child: _JobBody(job: j),
        ),
      ),
      bottomNavigationBar: loaded == null ? null : _PrimaryActions(job: loaded),
    );
  }
}

class _JobError extends StatelessWidget {
  const _JobError({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ContentWidth(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
              TextButton(onPressed: () => context.go('/home'), child: const Text('Back to home')),
            ],
          ),
        ),
      ),
    );
  }
}

String _guidance(JobDetail job) => switch (job.status) {
  TicketStatus.assigned => 'Call the site contact first — it may be fixable over the phone.',
  TicketStatus.enRoute => 'When you reach the site, ask the contact for the 4-digit start code.',
  TicketStatus.arrived => 'Starting work…',
  TicketStatus.inProgress => 'Take a before photo, fix the issue, then take an after photo.',
  TicketStatus.onHold => 'This job is on hold. Resume when you are back on it.',
  TicketStatus.resolved => 'Ask the site contact for the closing code, or they can confirm on their portal.',
  TicketStatus.remoteResolved => 'Waiting for the company to confirm the fix.',
  TicketStatus.closed => job.ratedByEngineer ? 'Job closed. Thanks!' : 'Job closed — rate the company to finish.',
  _ => '',
};

class _JobBody extends StatelessWidget {
  const _JobBody({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context) {
    final site = job.site;
    final guidance = _guidance(job);
    const gap = SizedBox(height: 16);
    return PageList(
      children: [
        _Header(job: job),
        if (job.status == TicketStatus.cancelled) ...[gap, const _CancelledBanner()],
        if (job.status != TicketStatus.cancelled) ...[const SizedBox(height: 20), JobProgress(status: job.status)],
        if (guidance.isNotEmpty) ...[gap, _Guidance(text: guidance)],
        if (job.status == TicketStatus.inProgress || job.status == TicketStatus.onHold) ...[gap, _Tools(job: job)],
        if (site != null) ...[gap, _SiteCard(site: site)],
        if (job.description.isNotEmpty || job.triage.isNotEmpty) ...[gap, _IssueCard(job: job)],
        if (job.media.isNotEmpty) ...[gap, _PhotosCard(job: job)],
        if (job.parts.isNotEmpty) ...[gap, _PartsCard(job: job)],
        if (job.events.isNotEmpty) ...[gap, _Timeline(job: job)],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            StatusChip(job.status),
            if (job.priority == 'urgent') const Pill(label: 'Urgent', color: AppColors.urgent, icon: Icons.bolt),
          ],
        ),
        const SizedBox(height: 10),
        Text(job.title, style: text.headlineSmall),
        const SizedBox(height: 4),
        Text('${categoryLabel(job.category)} · ${job.companyName}', style: text.bodyMedium?.copyWith(color: scheme.onSurfaceVariant)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            _Amount(label: 'Visit fee', amount: job.feeEstimate),
            if (job.feeFinal != null) _Amount(label: 'Final', amount: job.feeFinal!, emphasise: true),
          ],
        ),
      ],
    );
  }
}

class _Amount extends StatelessWidget {
  const _Amount({required this.label, required this.amount, this.emphasise = false});
  final String label;
  final int amount;
  final bool emphasise;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '$label  ',
            style: text.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          TextSpan(
            text: rupees(amount),
            style: text.titleMedium?.copyWith(fontWeight: emphasise ? FontWeight.w800 : null),
          ),
        ],
      ),
    );
  }
}

class _CancelledBanner extends StatelessWidget {
  const _CancelledBanner();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: scheme.errorContainer, borderRadius: BorderRadius.circular(AppTheme.radius)),
      child: Row(
        children: [
          Icon(Icons.cancel_outlined, color: scheme.onErrorContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'This job was cancelled.',
              style: TextStyle(color: scheme.onErrorContainer, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Guidance extends StatelessWidget {
  const _Guidance({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppTheme.brandTint(scheme), borderRadius: BorderRadius.circular(AppTheme.radius)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.lightbulb_outline, size: 20, color: scheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(color: scheme.onSurface)),
          ),
        ],
      ),
    );
  }
}

/// Photos, parts and hold — the things an engineer does while on site.
class _Tools extends ConsumerWidget {
  const _Tools({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.read(jobProvider(job.id).notifier);

    Future<void> photo(String kind) async {
      final file = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 1600);
      if (file == null) return;
      await c.uploadPhoto(kind, file.path);
      showMessage('Photo added');
    }

    Future<void> addPart() async {
      final part = await promptPart(context);
      if (part == null) return;
      final needsApproval = await c.addPart(name: part.name, qty: part.qty, unitPrice: part.unitPrice);
      showMessage(needsApproval ? 'Part added — the company must approve it before you can finish' : 'Part added');
    }

    Future<void> hold() async {
      final reason = await promptText(context, title: 'Put job on hold?', label: 'Reason (e.g. waiting for part)', confirm: 'Hold');
      if (reason != null) await c.hold(reason);
    }

    final onSite = job.status == TicketStatus.inProgress;
    return AdaptiveGrid(
      children: [
        if (onSite) ...[
          _ToolButton(
            icon: Icons.photo_camera_outlined,
            label: 'Before photo',
            done: job.mediaOf('before').isNotEmpty,
            onPressed: () => photo('before'),
          ),
          _ToolButton(
            icon: Icons.photo_camera_outlined,
            label: 'After photo',
            done: job.mediaOf('after').isNotEmpty,
            onPressed: () => photo('after'),
          ),
        ],
        _ToolButton(icon: Icons.add_shopping_cart, label: 'Add part', onPressed: addPart),
        if (onSite) _ToolButton(icon: Icons.pause_circle_outline, label: 'Hold', onPressed: hold),
      ],
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({required this.icon, required this.label, required this.onPressed, this.done = false});
  final IconData icon;
  final String label;
  final bool done;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonalIcon(
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), alignment: Alignment.centerLeft),
      onPressed: () => onPressed().catchError(showError),
      icon: Icon(done ? Icons.check_circle : icon),
      label: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
    );
  }
}

class _SiteCard extends StatelessWidget {
  const _SiteCard({required this.site});
  final JobSite site;

  Future<void> _open(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      showMessage('Could not open ${uri.scheme == 'tel' ? 'the dialer' : 'maps'}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return SectionCard(
      title: site.label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _IconLine(
            icon: Icons.place_outlined,
            child: Text(site.address, style: text.bodyLarge),
          ),
          const SizedBox(height: 8),
          _IconLine(
            icon: Icons.person_outline,
            child: Text('${site.contactName} · +91 ${site.contactPhone}', style: muted),
          ),
          const SizedBox(height: 14),
          AdaptiveGrid(
            minItemWidth: 120,
            children: [
              OutlinedButton.icon(
                onPressed: () => _open(Uri(scheme: 'tel', path: '+91${site.contactPhone}')),
                icon: const Icon(Icons.call),
                label: const Text('Call'),
              ),
              FilledButton.icon(
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                onPressed: () => _open(
                  Uri.https('www.google.com', '/maps/dir/', {
                    'api': '1',
                    'destination': '${site.lat},${site.lng}',
                    'travelmode': 'driving',
                  }),
                ),
                icon: const Icon(Icons.navigation_outlined),
                label: const Text('Navigate'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IconLine extends StatelessWidget {
  const _IconLine({required this.icon, required this.child});
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Icon(icon, size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        const SizedBox(width: 10),
        Expanded(child: child),
      ],
    );
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = text.labelMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return SectionCard(
      title: 'Issue details',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (job.description.isNotEmpty) ...[Text(job.description, style: text.bodyLarge), const SizedBox(height: 12)],
          for (final (i, e) in job.triage.entries.indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            Text(triageLabel(job.category, e.key), style: muted),
            const SizedBox(height: 2),
            Text(e.value.isEmpty ? '—' : e.value, style: text.bodyLarge),
          ],
        ],
      ),
    );
  }
}

class _PhotosCard extends StatelessWidget {
  const _PhotosCard({required this.job});
  final JobDetail job;

  static const _groups = [('issue', 'From the company'), ('before', 'Before'), ('after', 'After')];

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return SectionCard(
      title: 'Photos',
      child: LayoutBuilder(
        builder: (context, constraints) {
          // About four thumbnails per row on phones, more on wider screens.
          final size = ((constraints.maxWidth - 3 * 8) / 4).clamp(64.0, 120.0);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final (kind, label) in _groups)
                if (job.mediaOf(kind).isNotEmpty) ...[
                  Text(label, style: text.labelLarge),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, runSpacing: 8, children: [for (final m in job.mediaOf(kind)) AuthedImage(m.url, size: size)]),
                  const SizedBox(height: 12),
                ],
            ],
          );
        },
      ),
    );
  }
}

class _PartsCard extends StatelessWidget {
  const _PartsCard({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return SectionCard(
      title: 'Parts used',
      child: Column(
        children: [
          for (final (i, p) in job.parts.indexed) ...[
            if (i > 0) const Divider(height: 20),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${p.name} × ${p.qty}', style: text.bodyLarge),
                      const SizedBox(height: 4),
                      switch (p.status) {
                        PartStatus.approved => const Pill(label: 'Approved', color: AppColors.online),
                        PartStatus.pending => const Pill(label: 'Waiting for company', color: AppColors.warning),
                        PartStatus.rejected => Pill(label: 'Rejected', color: scheme.error),
                      },
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(rupees(p.total), style: text.titleMedium),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final events = job.events.reversed.toList();
    return SectionCard(
      title: 'Timeline',
      child: Column(
        children: [
          for (final (i, e) in events.indexed)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 20,
                    child: Column(
                      children: [
                        const SizedBox(height: 5),
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: i == 0 ? scheme.primary : scheme.outline),
                        ),
                        if (i < events.length - 1) Expanded(child: Container(width: 2, color: scheme.outlineVariant)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(e.text, style: text.bodyMedium?.copyWith(fontWeight: i == 0 ? FontWeight.w600 : null)),
                          Text(dateTime(e.createdAt), style: text.bodySmall?.copyWith(color: scheme.onSurfaceVariant)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// The status-driven main action, pinned to the bottom of the screen.
class _PrimaryActions extends ConsumerWidget {
  const _PrimaryActions({required this.job});
  final JobDetail job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.read(jobProvider(job.id).notifier);
    final scheme = Theme.of(context).colorScheme;

    Future<void> remoteResolve() async {
      final note = await promptText(context, title: 'Fixed it remotely?', label: 'What did you do? (optional)', confirm: 'Mark fixed');
      if (note != null) await c.remoteResolve(note);
    }

    Future<void> cancelJob() async {
      final reason = await promptText(
        context,
        title: 'Cancel this job?',
        label: 'Reason',
        confirm: 'Cancel job',
        required: true,
        destructive: true,
      );
      if (reason == null) return;
      await c.cancel(reason);
      showMessage('Job cancelled. Repeated cancellations can pause new jobs for a while.');
      if (context.mounted) context.go('/home');
    }

    final secondary = Row(
      children: [
        Expanded(
          child: TextButton(onPressed: () => remoteResolve().catchError(showError), child: const Text('Fixed it remotely')),
        ),
        Expanded(
          child: TextButton(
            style: TextButton.styleFrom(foregroundColor: scheme.error),
            onPressed: () => cancelJob().catchError(showError),
            child: const Text('Cancel job'),
          ),
        ),
      ],
    );

    Future<void> withHaptic(Future<void> Function() action) async {
      HapticFeedback.mediumImpact();
      await action();
    }

    final children = switch (job.status) {
      TicketStatus.assigned => [
        BusyButton(label: 'Start journey', icon: Icons.two_wheeler, onPressed: () => withHaptic(c.startJourney)),
        const SizedBox(height: 4),
        secondary,
      ],
      TicketStatus.enRoute => [
        BusyButton(
          label: 'I\'ve arrived — enter start code',
          icon: Icons.pin_outlined,
          onPressed: () async {
            final otp = await promptOtp(
              context,
              title: 'Start code',
              hint: 'Ask the site contact for the 4-digit code shown on their portal.',
            );
            if (otp != null) await withHaptic(() => c.arrive(otp));
          },
        ),
        const SizedBox(height: 4),
        secondary,
      ],
      TicketStatus.arrived => [const Center(child: CircularProgressIndicator())],
      TicketStatus.inProgress => [
        BusyButton(
          label: 'Mark work done',
          icon: Icons.task_alt,
          style: FilledButton.styleFrom(backgroundColor: AppColors.accept),
          onPressed: () async {
            final note = await promptText(context, title: 'Work complete?', label: 'What did you fix? (optional)', confirm: 'Mark done');
            if (note != null) await withHaptic(() => c.resolve(note));
          },
        ),
      ],
      TicketStatus.onHold => [BusyButton(label: 'Resume work', icon: Icons.play_arrow, onPressed: () => withHaptic(c.resume))],
      TicketStatus.resolved => [
        BusyButton(
          label: 'Enter closing code',
          icon: Icons.lock_outline,
          onPressed: () async {
            final otp = await promptOtp(context, title: 'Closing code', hint: 'Ask the site contact for the closing code.');
            if (otp == null) return;
            await withHaptic(() => c.close(otp));
            showMessage('Job closed. Well done!');
          },
        ),
      ],
      TicketStatus.closed when !job.ratedByEngineer => [
        BusyButton(
          label: 'Rate the company',
          icon: Icons.star_outline,
          onPressed: () async {
            final rating = await promptRating(context);
            if (rating == null) return;
            await c.rate(rating.score, rating.comment);
            showMessage('Thanks for the feedback');
          },
        ),
      ],
      TicketStatus.cancelled => [FilledButton(onPressed: () => context.go('/home'), child: const Text('Back to home'))],
      _ => const <Widget>[],
    };
    if (children.isEmpty) return const SizedBox.shrink();
    return ActionBar(children: children);
  }
}
