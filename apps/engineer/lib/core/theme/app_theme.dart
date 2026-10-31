import 'package:flutter/material.dart';

/// The only place colours are defined. Brand and status colours match the web portal's tokens.
abstract final class AppColors {
  // EarthClique brand palette (Brand Book v1.0, p.13). Teal leads, coral only for small accents.
  static const brand = Color(0xFF0E6B76); // Teal
  static const deepTeal = Color(0xFF0B2E33);
  static const tealBright = Color(0xFF1F8F9B);
  static const coral = Color(0xFFEE5A3C);
  static const mist = Color(0xFFBFD9DC);
  static const tint = Color(0xFFE7F1F2);
  static const mutedText = Color(0xFF52696D);

  static const online = Color(0xFF25984D);
  static const offline = Color(0xFF6B7280);
  static const accept = Color(0xFF25984D);
  static const decline = Color(0xFFE5484D);
  static const warning = Color(0xFFED990E);
  static const info = Color(0xFF007CD9);
  static const urgent = Color(0xFFE5484D);
  static const ringBackground = deepTeal;
  static const onRing = Color(0xFFFFFFFF);
  static const onRingMuted = Color(0xB3FFFFFF);
  static const ringCard = Color(0x1FFFFFFF);
}

abstract final class AppTheme {
  static const radius = 16.0;

  /// Light brand-teal surface for highlighted cards; normal text colours stay readable on it.
  static Color brandTint(ColorScheme scheme) => Color.alphaBlend(scheme.primary.withValues(alpha: 0.08), scheme.surface);

  static BorderSide brandBorder(ColorScheme scheme) => BorderSide(color: scheme.primary.withValues(alpha: 0.35));

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.brand,
      // Keeps the primary colour close to the brand teal instead of a tonal reinterpretation.
      dynamicSchemeVariant: DynamicSchemeVariant.fidelity,
    ).copyWith(
      // Pin the exact brand values: white base, teal actions, deep teal text, coral as the accent.
      primary: AppColors.brand,
      onPrimary: Colors.white,
      tertiary: AppColors.coral,
      onTertiary: Colors.white,
      surface: Colors.white,
      onSurface: AppColors.deepTeal,
      onSurfaceVariant: AppColors.mutedText,
      surfaceContainerLowest: Colors.white,
      surfaceContainerLow: const Color(0xFFF3F8F9),
      outlineVariant: const Color(0xFFD5E6E8),
    );
    final base = ThemeData(colorScheme: scheme, useMaterial3: true);
    final text = base.textTheme;
    final buttonShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));

    return base.copyWith(
      scaffoldBackgroundColor: scheme.surface,
      textTheme: text.copyWith(
        headlineMedium: text.headlineMedium?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
        headlineSmall: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w600),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleLarge?.copyWith(fontWeight: FontWeight.w600, color: scheme.onSurface),
      ),
      cardTheme: CardThemeData(
        margin: EdgeInsets.zero,
        elevation: 0,
        color: scheme.surfaceContainerLow,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.6)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerLowest,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(54),
          shape: buttonShape,
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), shape: buttonShape),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: const Size(48, 48))),
      chipTheme: base.chipTheme.copyWith(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))),
      listTileTheme: const ListTileThemeData(minVerticalPadding: 12),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      dividerTheme: DividerThemeData(color: scheme.outlineVariant.withValues(alpha: 0.6), space: 1),
    );
  }
}
