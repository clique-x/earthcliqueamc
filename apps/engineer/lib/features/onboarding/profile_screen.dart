import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/catalog.dart';
import '../../core/session/me_controller.dart';
import '../../core/session/session_controller.dart';
import '../../core/ui/brand.dart';
import '../../core/ui/busy_button.dart';
import '../../core/ui/responsive.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.editing = false});

  /// Opened from the approval screen to change details, rather than as a sign-up step.
  final bool editing;

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _name = TextEditingController();
  final Set<String> _skills = {};
  double _radius = 10;
  String _employment = 'freelance';

  @override
  void initState() {
    super.initState();
    final me = ref.read(meProvider).valueOrNull;
    if (me != null) {
      _name.text = me.name;
      _skills.addAll(me.skills);
      _radius = me.serviceRadiusKm.clamp(2, 50).toDouble();
      _employment = me.employmentType;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  bool get _valid => _name.text.trim().length >= 2 && _skills.isNotEmpty;

  Future<void> _save() async {
    await ref
        .read(meProvider.notifier)
        .updateProfile(
          name: _name.text.trim(),
          skills: Category.values.map((c) => c.name).where(_skills.contains).toList(),
          serviceRadiusKm: _radius.round(),
          employmentType: _employment,
        );
    if (widget.editing && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.editing ? 'Edit profile' : 'Your profile'),
        actions: [
          if (!widget.editing) TextButton(onPressed: () => ref.read(sessionProvider.notifier).signOut(), child: const Text('Sign out')),
        ],
      ),
      body: PageList(
        top: 12,
        children: [
          if (!widget.editing) ...[const StepHeader(step: 1, total: 2, title: 'Tell us about your work'), const SizedBox(height: 20)],
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Full name (as on Aadhaar)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 24),
          Text('What can you fix?', style: text.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in Category.values)
                FilterChip(
                  label: Text(c.label),
                  selected: _skills.contains(c.name),
                  onSelected: (on) => setState(() => on ? _skills.add(c.name) : _skills.remove(c.name)),
                ),
            ],
          ),
          const SizedBox(height: 24),
          Text('How far will you travel? ${_radius.round()} km', style: text.titleSmall),
          Slider(
            value: _radius,
            min: 2,
            max: 50,
            divisions: 48,
            label: '${_radius.round()} km',
            onChanged: (v) => setState(() => _radius = v),
          ),
          const SizedBox(height: 16),
          Text('How do you work with Earthclique?', style: text.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            expandedInsets: EdgeInsets.zero,
            segments: const [
              ButtonSegment(value: 'freelance', label: Text('Freelance')),
              ButtonSegment(value: 'staff', label: Text('Staff')),
            ],
            selected: {_employment},
            onSelectionChanged: (s) => setState(() => _employment = s.first),
          ),
        ],
      ),
      bottomNavigationBar: ActionBar(
        children: [BusyButton(label: widget.editing ? 'Save' : 'Continue', onPressed: _valid ? _save : null)],
      ),
    );
  }
}
