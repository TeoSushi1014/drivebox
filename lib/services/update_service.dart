import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:version/version.dart';
import 'process_service.dart';

class UpdateInfo {
  final String version;
  final String downloadUrl;
  final String releaseNotes;
  final bool isRequired;

  UpdateInfo({
    required this.version,
    required this.downloadUrl,
    required this.releaseNotes,
    required this.isRequired,
  });

  factory UpdateInfo.fromJson(Map<String, dynamic> json) {
    return UpdateInfo(
      version: json['version'] as String,
      downloadUrl: json['download_url'] as String,
      releaseNotes: json['release_notes'] as String,
      isRequired: json['is_required'] as bool,
    );
  }
}

class UpdateService {
  final ProcessService _processService = ProcessService();
  final String _updateCheckUrl =
      'https://raw.githubusercontent.com/TeoSushi1014/drivebox/main/update_info.json';

  // Check for updates
  Future<UpdateInfo?> checkForUpdates() async {
    try {
      // Get the current app version
      final packageInfo = await PackageInfo.fromPlatform();
      final currentVersion = Version.parse(packageInfo.version);

      // Fetch update information from GitHub
      final response = await http.get(Uri.parse(_updateCheckUrl));

      if (response.statusCode == 200) {
        final updateData = jsonDecode(response.body);
        final latestVersion = Version.parse(updateData['version']);

        // If there's a newer version available
        if (latestVersion > currentVersion) {
          return UpdateInfo.fromJson(updateData);
        }
      }

      return null; // No update available or couldn't check
    } catch (e) {
      print('Error checking for updates: $e');
      return null;
    }
  }

  // Download and apply update
  Future<bool> downloadAndApplyUpdate(UpdateInfo updateInfo) async {
    try {
      // Get temp directory
      final tempDir = await getTemporaryDirectory();
      final downloadPath = path.join(tempDir.path, 'drivebox_update.exe');

      // Download the update
      final client = http.Client();
      final request = http.Request('GET', Uri.parse(updateInfo.downloadUrl));
      final response = await client.send(request);

      final file = File(downloadPath);
      final sink = file.openWrite();

      await response.stream.pipe(sink);
      await sink.flush();
      await sink.close();

      // Execute the installer and exit the current app
      await _processService.runProcess(downloadPath, [
        '/SILENT',
        '/CLOSEAPPLICATIONS',
      ]);

      // If we're here, it means the installer didn't close our app (which it should)
      // Let's exit ourselves
      exit(0);

      return true;
    } catch (e) {
      print('Error downloading or applying update: $e');
      return false;
    }
  }
}
