/// An error whose [message] can be shown to the engineer as-is.
abstract interface class UserFacingException implements Exception {
  String get message;
}

class ApiException implements UserFacingException {
  const ApiException(this.statusCode, this.message, {this.code});

  /// 0 when the request never reached the server.
  final int statusCode;
  @override
  final String message;
  final String? code;

  bool get isUnauthorized => statusCode == 401;
  bool get isConflict => statusCode == 409;

  @override
  String toString() => message;
}

/// A message suitable for showing to the engineer.
String errorMessage(Object error) => error is UserFacingException ? error.message : 'Something went wrong. Please try again.';
