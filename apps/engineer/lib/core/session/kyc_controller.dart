import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/json.dart';
import '../models/engineer.dart';
import 'session_controller.dart';

const requiredKycDocs = ['aadhaar', 'pan', 'selfie'];

final kycProvider = AsyncNotifierProvider<KycController, List<KycDoc>>(KycController.new);

class KycController extends AsyncNotifier<List<KycDoc>> {
  @override
  Future<List<KycDoc>> build() async {
    final token = ref.watch(sessionProvider.select((s) => s.valueOrNull?.token));
    if (token == null) return const [];
    return _fetch();
  }

  Future<List<KycDoc>> _fetch() async => asJsonList(await ref.read(apiClientProvider).get('/engineer/kyc')).map(KycDoc.fromJson).toList();

  Future<void> upload(String docType, String filePath) async {
    await ref.read(apiClientProvider).uploadImage('/engineer/kyc', query: {'docType': docType}, filePath: filePath);
    state = AsyncData(await _fetch());
  }
}

extension KycDocs on List<KycDoc> {
  bool has(String docType) => any((d) => d.docType == docType);
  bool get complete => requiredKycDocs.every(has);
}
