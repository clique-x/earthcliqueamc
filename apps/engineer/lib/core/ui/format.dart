import 'package:intl/intl.dart';

final _rupees = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _dateTime = DateFormat('d MMM, h:mm a');

String rupees(num amount) => _rupees.format(amount);

String dateTime(DateTime? value) => value == null ? '' : _dateTime.format(value);

/// Human distance: "Under 100 m", "450 m", "3.2 km".
String distance(double km) {
  if (km < 0.1) return 'Under 100 m';
  if (km < 1) return '${(km * 1000 / 50).round() * 50} m';
  return '${km.toStringAsFixed(1)} km';
}
