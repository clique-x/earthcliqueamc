import 'dart:math' as math;

import 'package:flutter/material.dart';

abstract final class Layout {
  /// Content never stretches wider than this, so screens read well on tablets and in landscape.
  static const maxContentWidth = 560.0;
  static const gutter = 16.0;

  /// Horizontal padding that keeps content centred at [maxContentWidth] on wide screens.
  static double sidePadding(double width) => math.max(gutter, (width - maxContentWidth) / 2);

  /// True when the screen is short (phones in landscape), so tall layouts should go side by side.
  static bool isShort(BuildContext context) => MediaQuery.sizeOf(context).height < 500;
}

/// A scrollable page body with standard padding and a capped, centred content width.
/// The scroll area itself stays full width so pull-to-refresh and scrolling work from the edges.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, this.top = 8, this.bottom = 32, this.alwaysScrollable = true});

  final List<Widget> children;
  final double top;
  final double bottom;
  final bool alwaysScrollable;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final side = Layout.sidePadding(constraints.maxWidth);
        return ListView(
          physics: alwaysScrollable ? const AlwaysScrollableScrollPhysics() : null,
          padding: EdgeInsets.fromLTRB(side, top, side, bottom),
          children: children,
        );
      },
    );
  }
}

/// Centres [child] horizontally and caps its width. Takes only the height its child needs,
/// so it is safe inside bottom bars, which are offered the full screen height.
class ContentWidth extends StatelessWidget {
  const ContentWidth({super.key, required this.child, this.maxWidth = Layout.maxContentWidth});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Center(
      heightFactor: 1,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

/// Bottom bar for a screen's main action, kept within thumb reach and above the system gesture area.
class ActionBar extends StatelessWidget {
  const ActionBar({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: scheme.surface,
        border: Border(top: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6))),
      ),
      child: SafeArea(
        top: false,
        child: ContentWidth(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(Layout.gutter, 12, Layout.gutter, 12),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
          ),
        ),
      ),
    );
  }
}

/// Lays children out two per row when there's room for their labels, otherwise one per row.
/// Accounts for the user's text size so labels never get clipped.
class AdaptiveGrid extends StatelessWidget {
  const AdaptiveGrid({super.key, required this.children, this.minItemWidth = 150, this.spacing = 10});

  final List<Widget> children;
  final double minItemWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final scaledMin = MediaQuery.textScalerOf(context).scale(minItemWidth);
    return LayoutBuilder(
      builder: (context, constraints) {
        final twoUp = (constraints.maxWidth - spacing) / 2 >= scaledMin;
        final itemWidth = twoUp ? (constraints.maxWidth - spacing) / 2 : constraints.maxWidth;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [for (final c in children) SizedBox(width: itemWidth, child: c)],
        );
      },
    );
  }
}

/// A titled section card used across detail screens.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
                ?trailing,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
