import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../config.dart';
import 'api_exception.dart';
import 'json.dart';

class ApiClient {
  ApiClient({required this.token, required this.onUnauthorized, http.Client? client}) : _client = client ?? http.Client();

  final String? Function() token;
  final void Function() onUnauthorized;
  final http.Client _client;

  static const _timeout = Duration(seconds: 20);

  Map<String, String> get authHeaders {
    final t = token();
    return t == null ? const {} : {'Authorization': 'Bearer $t'};
  }

  Future<Object?> get(String path, {Map<String, String>? query}) =>
      _send(() => _client.get(AppConfig.api(path, query), headers: authHeaders));

  Future<Object?> post(String path, {Json? body}) => _send(
    () => _client.post(
      AppConfig.api(path),
      headers: {...authHeaders, if (body != null) 'Content-Type': 'application/json'},
      body: body == null ? null : jsonEncode(body),
    ),
  );

  Future<Object?> delete(String path) => _send(() => _client.delete(AppConfig.api(path), headers: authHeaders));

  Future<Object?> patch(String path, {required Json body}) => _send(
    () => _client.patch(AppConfig.api(path), headers: {...authHeaders, 'Content-Type': 'application/json'}, body: jsonEncode(body)),
  );

  /// Multipart image upload; the API reads the kind/docType from the query string.
  Future<Object?> uploadImage(String path, {required Map<String, String> query, required String filePath}) {
    return _send(() async {
      final request = http.MultipartRequest('POST', AppConfig.api(path, query))
        ..headers.addAll(authHeaders)
        ..files.add(await http.MultipartFile.fromPath('file', filePath, contentType: _imageType(filePath)));
      return http.Response.fromStream(await _client.send(request));
    }, timeout: const Duration(seconds: 60));
  }

  MediaType _imageType(String path) {
    final ext = path.split('.').last.toLowerCase();
    return switch (ext) {
      'png' => MediaType('image', 'png'),
      'webp' => MediaType('image', 'webp'),
      'heic' || 'heif' => MediaType('image', 'heic'),
      _ => MediaType('image', 'jpeg'),
    };
  }

  Future<Object?> _send(Future<http.Response> Function() request, {Duration timeout = _timeout}) async {
    final hadToken = token() != null;
    http.Response res;
    try {
      res = await request().timeout(timeout);
    } on TimeoutException {
      throw const ApiException(0, 'The server is taking too long. Check your connection.');
    } on SocketException {
      throw const ApiException(0, 'Can\'t reach the server. Check your internet connection.');
    } on http.ClientException {
      throw const ApiException(0, 'Can\'t reach the server. Check your internet connection.');
    }

    Object? data;
    if (res.body.isNotEmpty) {
      try {
        data = jsonDecode(res.body);
      } on FormatException {
        data = null;
      }
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;

    final body = asJson(data);
    final error = ApiException(
      res.statusCode,
      body.strOrNull('message') ?? 'Request failed (${res.statusCode})',
      code: body.strOrNull('error'),
    );
    if (error.isUnauthorized && hadToken) onUnauthorized();
    throw error;
  }
}
