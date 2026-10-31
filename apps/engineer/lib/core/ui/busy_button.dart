import 'package:flutter/material.dart';

import 'messenger.dart';

/// A filled button that shows a spinner while [onPressed] runs and reports errors as a snackbar.
class BusyButton extends StatefulWidget {
  const BusyButton({super.key, required this.label, required this.onPressed, this.icon, this.style});

  final String label;
  final IconData? icon;
  final Future<void> Function()? onPressed;
  final ButtonStyle? style;

  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool _busy = false;

  Future<void> _run() async {
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } catch (e) {
      showError(e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)) : Text(widget.label);
    final onPressed = widget.onPressed == null || _busy ? null : _run;
    if (widget.icon != null && !_busy) {
      return FilledButton.icon(style: widget.style, onPressed: onPressed, icon: Icon(widget.icon), label: child);
    }
    return FilledButton(style: widget.style, onPressed: onPressed, child: child);
  }
}
