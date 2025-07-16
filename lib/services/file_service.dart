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
    final tempFile = File('${tempDir.path}/$fileName.part');

    // Get existing file size for resuming
    int startByte = 0;
    if (tempFile.existsSync()) {
      startByte = await tempFile.length();
    }

    final httpClient = http.Client();
    final request = http.Request('GET', Uri.parse(url));

    // Add Range header for resuming download
    if (startByte > 0) {
      request.headers['Range'] = 'bytes=$startByte-';
    }

    final response = await httpClient.send(request);

    // Check if the server supports resume
    final isResumable = response.statusCode == 206; // Partial content
    final isOK = response.statusCode == 200; // Full content

    if (!isResumable && !isOK) {
      throw Exception('Failed to download file: ${response.statusCode}');
    }

    // If server doesn't support resume or we're starting from 0, reset the file
    if (!isResumable) {
      startByte = 0;
      if (tempFile.existsSync()) {
        await tempFile.delete();
      }
    }

    final totalBytes =
        (isResumable ? startByte : 0) + (response.contentLength ?? 0);
    var receivedBytes = startByte;

    // Open file in append mode if resuming, otherwise write mode
    final IOSink fileSink = tempFile.openWrite(
      mode: startByte > 0 ? FileMode.append : FileMode.write,
    );

    try {
      // Stream the data to the file
      await for (final chunk in response.stream) {
        fileSink.add(chunk);
        receivedBytes += chunk.length;

        if (onProgress != null && totalBytes > 0) {
          final progress = receivedBytes / totalBytes;
          onProgress(progress);
        }
      }
    } finally {
      await fileSink.flush();
      await fileSink.close();
    }

    // Rename the temp file to the final file name after successful download
    if (tempFile.existsSync()) {
      await tempFile.rename(file.path);
    }

    return file;
  }

  // Validate a file against its expected SHA256 checksum
  Future<bool> validateChecksum(File file, String expectedChecksum) async {
    final bytes = await file.readAsBytes();
    final digest = sha256.convert(bytes);
    final checksum = digest.toString();

    return checksum == expectedChecksum;
  }

  // Check if a partial download exists
  Future<bool> hasPartialDownload(String fileName) async {
    final tempDir = await getTempDir();
    final partFile = File('${tempDir.path}/$fileName.part');
    return partFile.existsSync();
  }

  // Get the size of a partial download
  Future<int> getPartialDownloadSize(String fileName) async {
    final tempDir = await getTempDir();
    final partFile = File('${tempDir.path}/$fileName.part');
    if (!partFile.existsSync()) {
      return 0;
    }
    return await partFile.length();
  }

  // Delete a partial download
  Future<void> clearPartialDownload(String fileName) async {
    final tempDir = await getTempDir();
    final partFile = File('${tempDir.path}/$fileName.part');
    if (partFile.existsSync()) {
      await partFile.delete();
    }
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
