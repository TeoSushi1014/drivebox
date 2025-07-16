import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart' as services;
import '../models/application_model.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:http/http.dart' as http;

class ManifestService {
  // For development, use the local manifest.json file
  static const String localAssetPath = 'assets/drivebox_assets/manifest.json';

  // This URLs would be used in production
  static const String remoteManifestUrl =
      'https://raw.githubusercontent.com/TeoSushi1014/drivebox-assets/main/manifest.json';
  static const String backupManifestUrl =
      'https://github.com/TeoSushi1014/drivebox-assets/raw/main/manifest.json';

  Future<List<ApplicationModel>> fetchManifest() async {
    try {
      // First try remote URL
      try {
        final http.Response response = await http
            .get(
              Uri.parse(remoteManifestUrl),
              headers: {'Cache-Control': 'no-cache'},
            )
            .timeout(const Duration(seconds: 10));

        if (response.statusCode == 200) {
          return _parseManifestJson(response.body);
        }
      } catch (e) {
        print('Failed to fetch from primary URL: $e');
      }

      // Try backup URL if first one fails
      try {
        final http.Response backupResponse = await http
            .get(
              Uri.parse(backupManifestUrl),
              headers: {'Cache-Control': 'no-cache'},
            )
            .timeout(const Duration(seconds: 10));

        if (backupResponse.statusCode == 200) {
          return _parseManifestJson(backupResponse.body);
        }
      } catch (e) {
        print('Failed to fetch from backup URL: $e');
      }

      // Fall back to local asset if both remote URLs fail
      final String jsonString = await services.rootBundle.loadString(
        localAssetPath,
      );
      return _parseManifestJson(jsonString);
    } catch (e) {
      throw Exception('Error fetching manifest: $e');
    }
  }

  List<ApplicationModel> _parseManifestJson(String jsonString) {
    final Map<String, dynamic> data = jsonDecode(jsonString);
    final List<dynamic> appsList = data['applications'];
    return appsList
        .map((appJson) => ApplicationModel.fromJson(appJson))
        .toList();
  }
}
