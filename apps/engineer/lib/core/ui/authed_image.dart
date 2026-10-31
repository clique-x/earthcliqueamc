import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config.dart';
import '../session/session_controller.dart';

/// Loads an API `/files/...` image, which requires the Bearer header. Tap to view full screen.
class AuthedImage extends ConsumerWidget {
  const AuthedImage(this.path, {super.key, this.size = 96});

  final String path;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final headers = ref.watch(apiClientProvider).authHeaders;
    final scheme = Theme.of(context).colorScheme;
    final url = AppConfig.api(path).toString();
    return Semantics(
      button: true,
      label: 'Photo, tap to enlarge',
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => showDialog<void>(
          context: context,
          barrierColor: Colors.black87,
          builder: (_) => _PhotoViewer(url: url, headers: headers),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Image.network(
            url,
            headers: headers,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => Container(
              width: size,
              height: size,
              color: scheme.surfaceContainerHighest,
              child: Icon(Icons.broken_image_outlined, color: scheme.onSurfaceVariant),
            ),
            loadingBuilder: (context, child, progress) => progress == null
                ? child
                : Container(
                    width: size,
                    height: size,
                    color: scheme.surfaceContainerHighest,
                    child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
                  ),
          ),
        ),
      ),
    );
  }
}

class _PhotoViewer extends StatelessWidget {
  const _PhotoViewer({required this.url, required this.headers});
  final String url;
  final Map<String, String> headers;

  @override
  Widget build(BuildContext context) {
    return Dialog.fullscreen(
      backgroundColor: Colors.transparent,
      child: Stack(
        children: [
          Positioned.fill(
            child: InteractiveViewer(
              maxScale: 5,
              child: Center(child: Image.network(url, headers: headers)),
            ),
          ),
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: IconButton.filledTonal(tooltip: 'Close', onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
            ),
          ),
        ],
      ),
    );
  }
}
