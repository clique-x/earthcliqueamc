import 'package:flutter/material.dart';

import '../api/api_exception.dart';

final rootMessengerKey = GlobalKey<ScaffoldMessengerState>();

void showMessage(String message) {
  rootMessengerKey.currentState
    ?..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

void showError(Object error) => showMessage(errorMessage(error));
