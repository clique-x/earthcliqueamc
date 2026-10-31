import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The EarthClique mark as supplied (app-icon version), same file as the web portal.
/// Never recolour or redraw it (Brand Book p.12).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56});
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.asset(
        'assets/brand/earthclique-app-icon.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
        semanticLabel: 'EarthClique',
      ),
    );
  }
}

/// Short coral bar under a headline (Brand Book p.17).
class AccentBar extends StatelessWidget {
  const AccentBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 4,
      decoration: BoxDecoration(color: AppColors.coral, borderRadius: BorderRadius.circular(2)),
    );
  }
}

/// "Step 1 of 2" header with a progress bar for the sign-up flow.
class StepHeader extends StatelessWidget {
  const StepHeader({super.key, required this.step, required this.total, required this.title});
  final int step;
  final int total;
  final String title;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Step $step of $total', style: text.labelLarge?.copyWith(color: Theme.of(context).colorScheme.primary)),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(value: step / total, minHeight: 6),
        ),
        const SizedBox(height: 16),
        Text(title, style: text.headlineSmall),
      ],
    );
  }
}
