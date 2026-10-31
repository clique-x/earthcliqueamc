import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session/session_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/busy_button.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';
import 'otp_screen.dart';

final _phonePattern = RegExp(r'^[6-9]\d{9}$');

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  bool get _valid => _phonePattern.hasMatch(_phone.text);

  Future<void> _sendOtp() async {
    final phone = _phone.text;
    final devCode = await ref.read(sessionProvider.notifier).requestOtp(phone);
    if (!mounted) return;
    context.push(
      '/login/otp',
      extra: OtpArgs(phone: phone, devCode: devCode),
    );
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final muted = text.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    final showHint = _phone.text.length == 10 && !_valid;
    return Scaffold(
      body: SafeArea(
        child: PageList(
          top: Layout.isShort(context) ? 16 : 56,
          children: [
            const Align(alignment: Alignment.centerLeft, child: BrandMark()),
            const SizedBox(height: 24),
            Text('EarthClique Engineer', style: text.headlineMedium),
            const SizedBox(height: 12),
            const AccentBar(),
            const SizedBox(height: 12),
            Text('Sign in with your mobile number to get IT, network and CCTV jobs near you.', style: muted),
            const SizedBox(height: 32),
            TextField(
              controller: _phone,
              autofocus: true,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              maxLength: 10,
              autofillHints: const [AutofillHints.telephoneNumberNational],
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              style: text.titleLarge,
              decoration: InputDecoration(
                labelText: 'Mobile number',
                prefixText: '+91 ',
                counterText: '',
                errorText: showHint ? 'Enter a 10-digit Indian mobile number' : null,
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _valid ? _sendOtp().catchError(showError) : null,
            ),
            const SizedBox(height: 20),
            BusyButton(label: 'Send OTP', onPressed: _valid ? _sendOtp : null),
            const SizedBox(height: 16),
            Text(
              'We\'ll text you a 6-digit code. Standard SMS rates may apply.',
              style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
