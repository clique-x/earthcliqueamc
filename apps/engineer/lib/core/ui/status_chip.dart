import 'package:flutter/material.dart';

import '../models/catalog.dart';
import '../theme/app_theme.dart';

Color statusColor(TicketStatus status, ColorScheme scheme) => switch (status) {
  TicketStatus.assigned || TicketStatus.enRoute || TicketStatus.arrived || TicketStatus.inProgress => AppColors.info,
  TicketStatus.onHold || TicketStatus.searching => AppColors.warning,
  TicketStatus.resolved || TicketStatus.remoteResolved => AppColors.online,
  TicketStatus.cancelled || TicketStatus.unassigned => scheme.error,
  _ => scheme.onSurfaceVariant,
};

/// Short label suited to a chip; the full label is used in banners.
String shortStatusLabel(TicketStatus status) => switch (status) {
  TicketStatus.assigned => 'Assigned',
  TicketStatus.resolved => 'Awaiting close code',
  TicketStatus.remoteResolved => 'Fixed remotely',
  _ => status.label,
};

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final TicketStatus status;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status, Theme.of(context).colorScheme);
    return Pill(label: shortStatusLabel(status), color: color);
  }
}

/// Small coloured label (status, urgency).
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: color), const SizedBox(width: 4)],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(color: color, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Where a job is in its life: assigned → on the way → working → done.
class JobProgress extends StatelessWidget {
  const JobProgress({super.key, required this.status});
  final TicketStatus status;

  static const _steps = ['Assigned', 'On the way', 'Working', 'Done'];

  int? get _current => switch (status) {
    TicketStatus.assigned => 0,
    TicketStatus.enRoute => 1,
    TicketStatus.arrived || TicketStatus.inProgress || TicketStatus.onHold => 2,
    TicketStatus.resolved || TicketStatus.remoteResolved || TicketStatus.closed => 3,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final current = _current;
    if (current == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Semantics(
      label: 'Step ${current + 1} of ${_steps.length}: ${_steps[current]}',
      excludeSemantics: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < _steps.length; i++)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    height: 6,
                    margin: const EdgeInsets.only(right: 4),
                    decoration: BoxDecoration(
                      color: i <= current ? scheme.primary : scheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _steps[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.labelSmall?.copyWith(
                      color: i <= current ? scheme.onSurface : scheme.onSurfaceVariant,
                      fontWeight: i == current ? FontWeight.w700 : FontWeight.w400,
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
