import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/catalog.dart';
import '../../core/models/ring_offer.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/format.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';
import 'ring_controller.dart';

class RingScreen extends ConsumerStatefulWidget {
  const RingScreen({super.key});

  @override
  ConsumerState<RingScreen> createState() => _RingScreenState();
}

class _RingScreenState extends ConsumerState<RingScreen> {
  Timer? _tick;
  bool _busy = false;
  final Map<String, int> _total = {};

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
    if (ref.read(ringProvider) == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _leave());
    } else {
      HapticFeedback.heavyImpact();
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _leave() {
    if (!mounted) return;
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/home');
    }
  }

  Future<void> _accept() async {
    HapticFeedback.mediumImpact();
    setState(() => _busy = true);
    try {
      final ticketId = await ref.read(ringProvider.notifier).accept();
      if (mounted) context.pushReplacement('/job/$ticketId');
    } catch (e) {
      showError(e);
      _leave();
    }
  }

  Future<void> _decline() async {
    HapticFeedback.selectionClick();
    setState(() => _busy = true);
    await ref.read(ringProvider.notifier).decline();
    _leave();
  }

  @override
  Widget build(BuildContext context) {
    // Accept/decline navigate themselves; this handles ring.cancel and expiry.
    ref.listen(ringProvider, (_, next) {
      if (next == null && !_busy) {
        showMessage('The job request has ended');
        _leave();
      }
    });
    final ring = ref.watch(ringProvider);
    if (ring != null) _total.putIfAbsent(ring.offerId, () => ring.expiresAt.difference(DateTime.now()).inSeconds);
    return PopScope(
      canPop: ring == null,
      child: Scaffold(
        backgroundColor: AppColors.ringBackground,
        body: SafeArea(
          child: ring == null
              ? const SizedBox.shrink()
              : _RingBody(ring: ring, totalSeconds: _total[ring.offerId]!, busy: _busy, onAccept: _accept, onDecline: _decline),
        ),
      ),
    );
  }
}

class _RingBody extends StatelessWidget {
  const _RingBody({required this.ring, required this.totalSeconds, required this.busy, required this.onAccept, required this.onDecline});

  final RingOffer ring;
  final int totalSeconds;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final remaining = ring.expiresAt.difference(DateTime.now()).inSeconds.clamp(0, 999);
    final progress = totalSeconds <= 0 ? 0.0 : (remaining / totalSeconds).clamp(0.0, 1.0);
    final buttons = _Buttons(busy: busy, onAccept: onAccept, onDecline: onDecline);

    // Phones held sideways: summary on the left, details and buttons on the right.
    if (Layout.isShort(context)) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: _Summary(ring: ring, remaining: remaining, progress: progress, dialSize: 96),
              ),
            ),
            const SizedBox(width: 24),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: SingleChildScrollView(child: _Triage(ring: ring)),
                  ),
                  const SizedBox(height: 12),
                  buttons,
                ],
              ),
            ),
          ],
        ),
      );
    }

    final dial = math.min(132.0, MediaQuery.sizeOf(context).shortestSide * 0.34);
    return ContentWidth(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Everything above the buttons scrolls, so Accept/Decline stay on screen at any text size.
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Summary(ring: ring, remaining: remaining, progress: progress, dialSize: dial),
                    const SizedBox(height: 20),
                    _Triage(ring: ring),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            buttons,
          ],
        ),
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.ring, required this.remaining, required this.progress, required this.dialSize});

  final RingOffer ring;
  final int remaining;
  final double progress;
  final double dialSize;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    const on = TextStyle(color: AppColors.onRing);
    const muted = TextStyle(color: AppColors.onRingMuted);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text('NEW JOB REQUEST', style: text.labelLarge?.merge(muted).copyWith(letterSpacing: 1.2))),
            if (ring.isUrgent)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.urgent, borderRadius: BorderRadius.circular(20)),
                child: Text('URGENT', style: text.labelMedium?.merge(on).copyWith(fontWeight: FontWeight.w700)),
              ),
          ],
        ),
        const SizedBox(height: 20),
        Center(
          child: _CountdownDial(remaining: remaining, progress: progress, size: dialSize),
        ),
        const SizedBox(height: 20),
        Text(categoryLabel(ring.category), style: text.titleMedium?.merge(muted), textAlign: TextAlign.center),
        const SizedBox(height: 6),
        Text(ring.title, style: text.headlineSmall?.merge(on), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 10,
          runSpacing: 8,
          children: [
            _Fact(icon: Icons.near_me_outlined, label: distance(ring.distanceKm)),
            _Fact(icon: Icons.payments_outlined, label: rupees(ring.feeEstimate), bold: true),
          ],
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.label, this.bold = false});
  final IconData icon;
  final String label;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(color: AppColors.ringCard, borderRadius: BorderRadius.circular(24)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 20, color: AppColors.onRingMuted),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(color: AppColors.onRing, fontWeight: bold ? FontWeight.w700 : null),
          ),
        ],
      ),
    );
  }
}

/// Countdown ring with a soft pulse, so the screen reads as "ringing".
class _CountdownDial extends StatefulWidget {
  const _CountdownDial({required this.remaining, required this.progress, required this.size});
  final int remaining;
  final double progress;
  final double size;

  @override
  State<_CountdownDial> createState() => _CountdownDialState();
}

class _CountdownDialState extends State<_CountdownDial> with SingleTickerProviderStateMixin {
  late final _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final low = widget.remaining <= 10;
    final color = low ? AppColors.warning : AppColors.accept;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return SizedBox.square(
      dimension: widget.size * 1.3,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (!reduceMotion)
            AnimatedBuilder(
              animation: _pulse,
              builder: (_, _) => Container(
                width: widget.size * (1 + 0.3 * _pulse.value),
                height: widget.size * (1 + 0.3 * _pulse.value),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: color.withValues(alpha: 0.25 * (1 - _pulse.value)),
                ),
              ),
            ),
          SizedBox.square(
            dimension: widget.size,
            child: CircularProgressIndicator(value: widget.progress, strokeWidth: 7, color: color, backgroundColor: AppColors.ringCard),
          ),
          Semantics(
            label: '${widget.remaining} seconds left',
            excludeSemantics: true,
            child: Text(
              '${widget.remaining}',
              style: Theme.of(context).textTheme.displaySmall?.copyWith(color: AppColors.onRing, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Triage extends StatelessWidget {
  const _Triage({required this.ring});
  final RingOffer ring;

  @override
  Widget build(BuildContext context) {
    if (ring.triage.isEmpty) return const SizedBox.shrink();
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.ringCard, borderRadius: BorderRadius.circular(AppTheme.radius)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (i, e) in ring.triage.entries.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            Text(triageLabel(ring.category, e.key), style: text.labelMedium?.copyWith(color: AppColors.onRingMuted)),
            const SizedBox(height: 2),
            Text(e.value.isEmpty ? '—' : e.value, style: text.bodyLarge?.copyWith(color: AppColors.onRing)),
          ],
        ],
      ),
    );
  }
}

class _Buttons extends StatelessWidget {
  const _Buttons({required this.busy, required this.onAccept, required this.onDecline});
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    ButtonStyle style(Color bg) => FilledButton.styleFrom(
      backgroundColor: bg,
      foregroundColor: AppColors.onRing,
      minimumSize: const Size.fromHeight(64),
      textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
    );
    return Row(
      children: [
        Expanded(
          flex: 2,
          child: FilledButton.icon(
            style: style(AppColors.decline),
            onPressed: busy ? null : onDecline,
            icon: const Icon(Icons.close),
            label: const FittedBox(child: Text('Decline')),
          ),
        ),
        const SizedBox(width: 12),
        // Accept is wider and on the right, where the thumb rests.
        Expanded(
          flex: 3,
          child: FilledButton.icon(
            style: style(AppColors.accept),
            onPressed: busy ? null : onAccept,
            icon: busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.onRing))
                : const Icon(Icons.check),
            label: const FittedBox(child: Text('Accept')),
          ),
        ),
      ],
    );
  }
}
