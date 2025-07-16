import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:archive/archive.dart';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';

class FileService {
  // Directory where temporary files are stored during download/installation
  Future<Directory> getTempDir() async {
    final tempDir = await getTemporaryDirectory();
    final driveboxTempDir = Directory('${tempDir.path}/drivebox_temp');

    if (!driveboxTempDir.existsSync()) {
      await driveboxTempDir.create(recursive: true);
    }

    return driveboxTempDir;
  }

  // Download a file from a URL to the temporary directory
  Future<File> downloadFile({
    required String url,
    required String fileName,
    Function(double)? onProgress,
  }) async {
    final tempDir = await getTempDir();
    final file = File('${tempDir.path}/$fileName');

    final httpClient = http.Client();
    final request = http.Request('GET', Uri.parse(url));
    final response = await httpClient.send(request);

    if (response.statusCode != 200) {
      throw Exception('Failed to download file: ${response.statusCode}');
    }

    final totalBytes = response.contentLength ?? 0;
    var receivedBytes = 0;

    List<int> bytes = [];

    await for (final chunk in response.stream) {
      bytes.addAll(chunk);
      receivedBytes += chunk.length;

      if (onProgress != null && totalBytes > 0) {
        final progress = receivedBytes / totalBytes;
        onProgress(progress);
      }
    }

    await file.writeAsBytes(bytes);
    return file;
  }

  // Validate a file against its expected SHA256 checksum
  Future<bool> validateChecksum(File file, String expectedChecksum) async {
    final bytes = await file.readAsBytes();
    final digest = sha256.convert(bytes);
    final checksum = digest.toString();

    return checksum == expectedChecksum;
  }

  // Extract a ZIP file to the specified directory
  Future<void> extractZip(File zipFile, String destinationDir) async {
    final bytes = await zipFile.readAsBytes();
    final archive = ZipDecoder().decodeBytes(bytes);

    final destination = Directory(destinationDir);
    if (!destination.existsSync()) {
      await destination.create(recursive: true);
    }

    for (final file in archive) {
      final filePath = path.join(destinationDir, file.name);

      if (file.isFile) {
        final fileData = file.content as Uint8List;
        final outFile = File(filePath);

        await outFile.create(recursive: true);
        await outFile.writeAsBytes(fileData);
      } else {
        final dir = Directory(filePath);
        if (!dir.existsSync()) {
          await dir.create(recursive: true);
        }
      }
    }
  }

  // Clean up the temporary directory
  Future<void> cleanupTempDir() async {
    final tempDir = await getTempDir();
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  }
}
