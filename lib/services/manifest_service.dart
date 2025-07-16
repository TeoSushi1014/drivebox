import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart' as services;
import '../models/application_model.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;

class ManifestService {
  // For development, use the local manifest.json file
  static const String localAssetPath = 'drivebox_assets/manifest.json';

  // This URL would be used in production
  static const String remoteManifestUrl =
      'https://raw.githubusercontent.com/TeoSushi1014/drivebox-assets/main/manifest.json';

  Future<List<ApplicationModel>> fetchManifest() async {
    try {
      // First try to load from the local file system
      final String jsonString = await services.rootBundle.loadString(
        localAssetPath,
      );
      final Map<String, dynamic> data = jsonDecode(jsonString);
      final List<dynamic> appsList = data['applications'];

      return appsList
          .map((appJson) => ApplicationModel.fromJson(appJson))
          .toList();
    } catch (e) {
      throw Exception('Error fetching manifest: $e');
    }
  }
}
