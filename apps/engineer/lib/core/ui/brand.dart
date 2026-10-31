import 'package:flutter/material.dart';

/// The "EC" mark used on the web portal, so both products feel like one brand.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 56});
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: scheme.primary, borderRadius: BorderRadius.circular(size * 0.28)),
      child: Text(
        'EC',
        style: TextStyle(color: scheme.onPrimary, fontWeight: FontWeight.w800, fontSize: size * 0.36, letterSpacing: 0.5),
      ),
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
