import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart' as services;
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/app_state_bloc.dart';
import '../models/application_model.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as path;
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';

class ManifestService {
  // For development, use the local manifest.json file
  static const String localAssetPath = 'assets/drivebox_assets/manifest.json';

  // This URLs would be used in production
  static const String remoteManifestUrl =
      'https://raw.githubusercontent.com/TeoSushi1014/drivebox-assets/main/manifest.json';
  static const String backupManifestUrl =
      'https://github.com/TeoSushi1014/drivebox-assets/raw/main/manifest.json';

  // GitHub API URL for fetching releases
  static const String githubApiReleasesUrl =
      'https://api.github.com/repos/TeoSushi1014/drivebox-assets/releases';

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
    final appModels = appsList
        .map((appJson) => ApplicationModel.fromJson(appJson))
        .toList();

    // After parsing the manifest, update with GitHub release sizes
    // Note: This is async but we return immediately for backward compatibility
    // The UI will display initial sizes from manifest, then update when GitHub data arrives
    updateAppSizesFromGitHub(appModels);

    return appModels;
  }

  // Fetch release information from GitHub and update app sizes
  Future<void> updateAppSizesFromGitHub(List<ApplicationModel> apps) async {
    try {
      final response = await http.get(
        Uri.parse(githubApiReleasesUrl),
        headers: {'Accept': 'application/vnd.github.v3+json'},
      );

      if (response.statusCode == 200) {
        final releases = jsonDecode(response.body) as List;
        final Map<String, int> assetSizes = {};
        bool sizeUpdated = false;

        // Extract asset information from all releases
        for (final release in releases) {
          final assets = release['assets'] as List;
          for (final asset in assets) {
            final name = asset['name'] as String;
            final size = asset['size'] as int;
            assetSizes[name] = size;
          }
        }

        // Update each app with the total size of its modules
        for (final app in apps) {
          int totalSizeBytes = 0;

          for (final module in app.modules) {
            // Extract the filename from the URL
            final Uri uri = Uri.parse(module.url);
            final String path = uri.path;
            final String fileName = path.substring(path.lastIndexOf('/') + 1);

            if (assetSizes.containsKey(fileName)) {
              totalSizeBytes += assetSizes[fileName]!;
              sizeUpdated = true;
            }
          }

          // Update app size
          if (totalSizeBytes > 0) {
            // Convert bytes to appropriate unit
            if (totalSizeBytes >= 1024 * 1024 * 1024) {
              // Size in GB
              final sizeGB = totalSizeBytes / (1024 * 1024 * 1024);
              app.sizeValue = sizeGB;
              app.sizeUnit = 'GB';
            } else {
              // Size in MB
              final sizeMB = totalSizeBytes / (1024 * 1024);
              app.sizeValue = sizeMB;
              app.sizeUnit = 'MB';
            }
          }
        }

        // If sizes were updated, notify the bloc to update the UI
        if (sizeUpdated) {
          // We need a BuildContext to access the BlocProvider, so this needs to be called
          // from a widget that has access to the context. For now, we'll rely on the caller
          // to handle the updated apps list.
          // If a global navigatorKey is available, we could use that to get the context.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            try {
              // Get the current context from the navigator key if available
              if (navigatorKey.currentContext != null) {
                final context = navigatorKey.currentContext!;
                if (context.mounted) {
                  // Dispatch the event to update app sizes
                  BlocProvider.of<AppBloc>(
                    context,
                  ).add(UpdateAppSizesEvent(List.from(apps)));
                }
              }
            } catch (e) {
              print('Error updating app sizes in bloc: $e');
            }
          });
        }
      }
    } catch (e) {
      print('Error fetching release information: $e');
      // Continue with manifest sizes if GitHub API fails
    }
  }
}

// Global navigator key to access context from services
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
