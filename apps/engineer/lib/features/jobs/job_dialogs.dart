import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PartInput {
  const PartInput({required this.name, required this.qty, required this.unitPrice});
  final String name;
  final int qty;
  final int unitPrice;
}

Future<PartInput?> promptPart(BuildContext context) => showDialog<PartInput>(context: context, builder: (_) => const _PartDialog());

class _PartDialog extends StatefulWidget {
  const _PartDialog();

  @override
  State<_PartDialog> createState() => _PartDialogState();
}

class _PartDialogState extends State<_PartDialog> {
  final _name = TextEditingController();
  final _qty = TextEditingController(text: '1');
  final _price = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _qty.dispose();
    _price.dispose();
    super.dispose();
  }

  PartInput? get _value {
    final qty = int.tryParse(_qty.text);
    final price = int.tryParse(_price.text);
    if (_name.text.trim().length < 2 || qty == null || qty < 1 || qty > 100 || price == null) return null;
    return PartInput(name: _name.text.trim(), qty: qty, unitPrice: price);
  }

  @override
  Widget build(BuildContext context) {
    final value = _value;
    return AlertDialog(
      title: const Text('Add part'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(labelText: 'Part name (e.g. 8 GB RAM)'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qty,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Qty'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _price,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(labelText: 'Unit price', prefixText: '₹ '),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
          onPressed: value == null ? null : () => Navigator.pop(context, value),
          child: const Text('Add'),
        ),
      ],
    );
  }
}

class RatingInput {
  const RatingInput(this.score, this.comment);
  final int score;
  final String comment;
}

Future<RatingInput?> promptRating(BuildContext context) => showDialog<RatingInput>(context: context, builder: (_) => const _RatingDialog());

class _RatingDialog extends StatefulWidget {
  const _RatingDialog();

  @override
  State<_RatingDialog> createState() => _RatingDialogState();
}

class _RatingDialogState extends State<_RatingDialog> {
  int _score = 0;
  final _comment = TextEditingController();

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: const Text('Rate this company'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              for (var i = 1; i <= 5; i++)
                IconButton(
                  iconSize: 36,
                  onPressed: () => setState(() => _score = i),
                  icon: Icon(i <= _score ? Icons.star : Icons.star_border, color: scheme.primary),
                ),
            ],
          ),
          TextField(
            controller: _comment,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Comment (optional)'),
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Later')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
          onPressed: _score == 0 ? null : () => Navigator.pop(context, RatingInput(_score, _comment.text.trim())),
          child: const Text('Submit'),
        ),
      ],
    );
  }
}
