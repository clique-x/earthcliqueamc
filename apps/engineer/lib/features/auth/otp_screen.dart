import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/session/session_controller.dart';
import '../../core/ui/busy_button.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';

class OtpArgs {
  const OtpArgs({required this.phone, this.devCode});
  final String phone;
  final String? devCode;
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  static const _resendAfter = 30;

  late final _code = TextEditingController(text: kDebugMode ? widget.args.devCode ?? '' : '');
  Timer? _timer;
  int _wait = _resendAfter;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _startResendTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startResendTimer() {
    _timer?.cancel();
    setState(() => _wait = _resendAfter);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_wait <= 1) t.cancel();
      setState(() => _wait--);
    });
  }

  Future<void> _verify() async {
    if (_verifying) return;
    _verifying = true;
    try {
      await ref.read(sessionProvider.notifier).verifyOtp(widget.args.phone, _code.text);
    } finally {
      _verifying = false;
    }
  }

  Future<void> _resend() async {
    try {
      final devCode = await ref.read(sessionProvider.notifier).requestOtp(widget.args.phone);
      if (kDebugMode && devCode != null) _code.text = devCode;
      _startResendTimer();
      showMessage('A new OTP has been sent');
    } catch (e) {
      showError(e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = text.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Scaffold(
      appBar: AppBar(),
      body: PageList(
        children: [
          Text('Enter OTP', style: text.headlineMedium),
          const SizedBox(height: 8),
          Text('We sent a 6-digit code to +91 ${widget.args.phone}', style: muted),
          if (kDebugMode && widget.args.devCode != null) ...[
            const SizedBox(height: 8),
            Text('Dev build: code filled in from the API', style: text.bodySmall),
          ],
          const SizedBox(height: 24),
          TextField(
            controller: _code,
            autofocus: true,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            maxLength: 6,
            textAlign: TextAlign.center,
            style: text.headlineMedium?.copyWith(letterSpacing: 12),
            decoration: const InputDecoration(counterText: ''),
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (value) {
              setState(() {});
              // Typing the last digit signs in straight away.
              if (value.length == 6) _verify().catchError(showError);
            },
          ),
          const SizedBox(height: 20),
          BusyButton(label: 'Verify', onPressed: _code.text.length == 6 ? _verify : null),
          const SizedBox(height: 8),
          TextButton(onPressed: _wait > 0 ? null : _resend, child: Text(_wait > 0 ? 'Resend OTP in ${_wait}s' : 'Resend OTP')),
        ],
      ),
    );
  }
}
