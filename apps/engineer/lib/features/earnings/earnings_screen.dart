import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/earnings.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/format.dart';
import '../../core/ui/responsive.dart';
import 'earnings_provider.dart';

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final earnings = ref.watch(earningsProvider);
    final muted = Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(earningsProvider.future),
        child: PageList(
          children: [
            earnings.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Text(errorMessage(e)),
              data: (e) => Column(
                children: [
                  _PeriodCard(label: 'Today', period: e.today, highlight: true),
                  const SizedBox(height: 12),
                  AdaptiveGrid(
                    minItemWidth: 140,
                    children: [
                      _PeriodCard(label: 'This week', period: e.week),
                      _PeriodCard(label: 'This month', period: e.month),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Job value of closed jobs (visit fee plus approved parts). Payments are settled by Earthclique outside the app for now.',
              style: muted,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => context.push('/history'),
              icon: const Icon(Icons.history),
              label: const Text('Job history'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriodCard extends StatelessWidget {
  const _PeriodCard({required this.label, required this.period, this.highlight = false});
  final String label;
  final EarningsPeriod period;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final fg = scheme.onSurface;
    return Card(
      color: highlight ? AppTheme.brandTint(scheme) : null,
      shape: highlight
          ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppTheme.radius), side: AppTheme.brandBorder(scheme))
          : null,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: text.labelLarge?.copyWith(color: fg)),
            const SizedBox(height: 6),
            FittedBox(
              alignment: Alignment.centerLeft,
              fit: BoxFit.scaleDown,
              child: Text(rupees(period.amount), style: (highlight ? text.headlineMedium : text.headlineSmall)?.copyWith(color: fg)),
            ),
            const SizedBox(height: 2),
            Text('${period.jobs} job${period.jobs == 1 ? '' : 's'}', style: text.bodySmall?.copyWith(color: fg.withValues(alpha: 0.75))),
          ],
        ),
      ),
    );
  }
}
