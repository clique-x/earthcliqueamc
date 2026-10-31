import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/api_exception.dart';
import '../../core/session/kyc_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/messenger.dart';
import '../../core/ui/responsive.dart';

const _docInfo = {
  'aadhaar': ('Aadhaar card', 'Photo of the front of your Aadhaar', Icons.badge_outlined),
  'pan': ('PAN card', 'Photo of your PAN card', Icons.credit_card),
  'selfie': ('Selfie', 'A clear photo of your face — shown to companies', Icons.face),
};

class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key, this.editing = false});
  final bool editing;

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  final _picker = ImagePicker();
  String? _uploading;

  Future<void> _pick(String docType) async {
    final source = docType == 'selfie' ? ImageSource.camera : await _chooseSource();
    if (source == null) return;
    final file = await _picker.pickImage(
      source: source,
      imageQuality: 75,
      maxWidth: 1800,
      preferredCameraDevice: docType == 'selfie' ? CameraDevice.front : CameraDevice.rear,
    );
    if (file == null) return;
    setState(() => _uploading = docType);
    try {
      await ref.read(kycProvider.notifier).upload(docType, file.path);
      showMessage('${_docInfo[docType]!.$1} uploaded');
    } catch (e) {
      showMessage(errorMessage(e));
    } finally {
      if (mounted) setState(() => _uploading = null);
    }
  }

  Future<ImageSource?> _chooseSource() => showModalBottomSheet<ImageSource>(
    context: context,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_camera),
            title: const Text('Take a photo'),
            onTap: () => Navigator.pop(context, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library),
            title: const Text('Choose from gallery'),
            onTap: () => Navigator.pop(context, ImageSource.gallery),
          ),
        ],
      ),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final docs = ref.watch(kycProvider).valueOrNull ?? const [];
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(widget.editing ? 'Documents' : 'Verify your identity')),
      body: PageList(
        top: 12,
        children: [
          if (!widget.editing) ...[const StepHeader(step: 2, total: 2, title: 'Verify your identity'), const SizedBox(height: 12)],
          Text(
            'Earthclique verifies every engineer before they receive jobs. Documents are only seen by our team.',
            style: text.bodyMedium,
          ),
          const SizedBox(height: 20),
          for (final entry in _docInfo.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: CircleAvatar(
                    radius: 22,
                    backgroundColor: docs.has(entry.key) ? scheme.primaryContainer : scheme.surfaceContainerHighest,
                    child: Icon(entry.value.$3, color: docs.has(entry.key) ? scheme.onPrimaryContainer : scheme.onSurfaceVariant),
                  ),
                  title: Text(entry.value.$1),
                  subtitle: Text(docs.has(entry.key) ? 'Uploaded — tap to replace' : entry.value.$2),
                  trailing: _uploading == entry.key
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
                      : Icon(docs.has(entry.key) ? Icons.check_circle : Icons.upload, color: docs.has(entry.key) ? scheme.primary : null),
                  onTap: _uploading == null ? () => _pick(entry.key) : null,
                ),
              ),
            ),
          if (widget.editing) ...[const SizedBox(height: 16), FilledButton(onPressed: () => context.pop(), child: const Text('Done'))],
        ],
      ),
    );
  }
}
