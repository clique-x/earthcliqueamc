import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/catalog.dart';
import '../../core/models/job.dart';
import '../../core/ui/format.dart';
import '../../core/ui/responsive.dart';
import '../../core/ui/status_chip.dart';
import 'active_job_provider.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(jobHistoryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Job history')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(jobHistoryProvider.future),
        child: history.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => PageList(
            children: [_Empty(icon: Icons.cloud_off, text: errorMessage(e))],
          ),
          data: (jobs) => jobs.isEmpty
              ? const PageList(
                  children: [_Empty(icon: Icons.inbox_outlined, text: 'No past jobs yet. Finished jobs will show up here.')],
                )
              : LayoutBuilder(
                  builder: (context, constraints) {
                    final side = Layout.sidePadding(constraints.maxWidth);
                    return ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: EdgeInsets.fromLTRB(side, 8, side, 32),
                      itemCount: jobs.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, i) => _HistoryCard(job: jobs[i]),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.job});
  final JobSummary job;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Card(
      child: InkWell(
        onTap: () => context.push('/job/${job.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(job.title, style: text.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 12),
                  Text(rupees(job.feeFinal ?? job.feeEstimate), style: text.titleMedium),
                ],
              ),
              const SizedBox(height: 4),
              Text('${job.code} · ${categoryLabel(job.category)} · ${job.siteLabel}', style: muted),
              const SizedBox(height: 10),
              Row(
                children: [
                  Flexible(child: StatusChip(job.status)),
                  const SizedBox(width: 8),
                  Text(dateTime(job.closedAt ?? job.assignedAt), style: muted),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 64),
      child: Column(
        children: [
          Icon(icon, size: 48, color: scheme.onSurfaceVariant),
          const SizedBox(height: 12),
          Text(
            text,
            textAlign: TextAlign.center,
            style: TextStyle(color: scheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}
