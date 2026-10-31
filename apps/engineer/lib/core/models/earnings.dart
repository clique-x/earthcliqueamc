import '../api/json.dart';

class EarningsPeriod {
  const EarningsPeriod({required this.amount, required this.jobs});

  factory EarningsPeriod.fromJson(Json j) => EarningsPeriod(amount: j.integer('sum'), jobs: j.integer('jobs'));

  final int amount;
  final int jobs;
}

class Earnings {
  const Earnings({required this.today, required this.week, required this.month});

  factory Earnings.fromJson(Json j) => Earnings(
    today: EarningsPeriod.fromJson(j.obj('today')),
    week: EarningsPeriod.fromJson(j.obj('week')),
    month: EarningsPeriod.fromJson(j.obj('month')),
  );

  final EarningsPeriod today;
  final EarningsPeriod week;
  final EarningsPeriod month;
}
