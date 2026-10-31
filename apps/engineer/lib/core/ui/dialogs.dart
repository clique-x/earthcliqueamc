import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Asks for a numeric OTP; returns null if dismissed.
Future<String?> promptOtp(BuildContext context, {required String title, required String hint, int length = 4}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _OtpDialog(title: title, hint: hint, length: length),
  );
}

class _OtpDialog extends StatefulWidget {
  const _OtpDialog({required this.title, required this.hint, required this.length});
  final String title;
  final String hint;
  final int length;

  @override
  State<_OtpDialog> createState() => _OtpDialogState();
}

class _OtpDialogState extends State<_OtpDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _valid => _controller.text.length == widget.length;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.hint),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: widget.length,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(letterSpacing: 12),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            onSubmitted: (_) => _valid ? Navigator.pop(context, _controller.text) : null,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
          onPressed: _valid ? () => Navigator.pop(context, _controller.text) : null,
          child: const Text('Submit'),
        ),
      ],
    );
  }
}

/// Free-text prompt (note, reason). Returns null if dismissed, otherwise the trimmed text (may be empty unless [required]).
Future<String?> promptText(
  BuildContext context, {
  required String title,
  required String label,
  required String confirm,
  bool required = false,
  bool destructive = false,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _TextDialog(title: title, label: label, confirm: confirm, required: required, destructive: destructive),
  );
}

class _TextDialog extends StatefulWidget {
  const _TextDialog({required this.title, required this.label, required this.confirm, required this.required, required this.destructive});
  final String title;
  final String label;
  final String confirm;
  final bool required;
  final bool destructive;

  @override
  State<_TextDialog> createState() => _TextDialogState();
}

class _TextDialogState extends State<_TextDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final enabled = !widget.required || _controller.text.trim().isNotEmpty;
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _controller,
        autofocus: true,
        maxLines: 3,
        maxLength: 500,
        decoration: InputDecoration(labelText: widget.label),
        onChanged: (_) => setState(() {}),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Back')),
        FilledButton(
          style: FilledButton.styleFrom(
            minimumSize: const Size(96, 44),
            backgroundColor: widget.destructive ? scheme.error : null,
            foregroundColor: widget.destructive ? scheme.onError : null,
          ),
          onPressed: enabled ? () => Navigator.pop(context, _controller.text.trim()) : null,
          child: Text(widget.confirm),
        ),
      ],
    );
  }
}
