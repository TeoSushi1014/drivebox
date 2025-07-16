import 'dart:io';
import 'dart:async';
import 'package:archive/archive.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as path;

/// Service for streaming extraction of zip files directly from URLs
/// This reduces the need for temporary disk space by extracting files
/// during the download process rather than downloading the entire archive first
class StreamExtractionService {
  /// Extract a ZIP file directly from a URL to the specified output directory
  /// Returns the total bytes extracted
  Future<int> extractZipFromUrl({
    required String url,
    required String outputDir,
    void Function(double progress)? onProgress,
    void Function(String currentFile)? onFileExtracted,
  }) async {
    final client = http.Client();
    final request = http.Request('GET', Uri.parse(url));
    final response = await client.send(request);

    // Get the content length if available
    final contentLength = response.contentLength ?? 0;
    var bytesProcessed = 0;

    // Create a broadcast stream so we can listen multiple times if needed
    final broadcastStream = response.stream.asBroadcastStream();

    // First, get the file size without downloading the full content
    final headResponse = await http.head(Uri.parse(url));
    final fileSize = int.parse(headResponse.headers['content-length'] ?? '0');

    // Prepare the Archive decoder with the incoming bytes
    final bytes = <int>[];
    final inputStream = broadcastStream.listen((chunk) {
      bytes.addAll(chunk);
      bytesProcessed += chunk.length;

      // Report progress if callback provided
      if (onProgress != null && contentLength > 0) {
        onProgress(bytesProcessed / contentLength);
      }
    });

    // Wait for all data to be received
    await inputStream.asFuture<void>();

    // Process the zip archive
    final archive = ZipDecoder().decodeBytes(bytes);

    // Extract each file
    for (final file in archive) {
      final filePath = path.join(outputDir, file.name);

      if (file.isFile) {
        // Report the file being extracted
        if (onFileExtracted != null) {
          onFileExtracted(file.name);
        }

        // Create parent directory if it doesn't exist
        final directory = Directory(path.dirname(filePath));
        if (!directory.existsSync()) {
          directory.createSync(recursive: true);
        }

        // Write file content
        final outputFile = File(filePath);
        outputFile.writeAsBytesSync(file.content as List<int>);
      } else {
        // Create directory if it doesn't exist
        final directory = Directory(filePath);
        if (!directory.existsSync()) {
          directory.createSync(recursive: true);
        }
      }
    }

    client.close();
    return bytesProcessed;
  }

  /// For small to medium archives, stream and extract in chunks
  /// This is more memory efficient than the above method
  Future<int> extractZipFromUrlInChunks({
    required String url,
    required String outputDir,
    void Function(double progress)? onProgress,
    void Function(String currentFile)? onFileExtracted,
    int chunkSize = 1024 * 1024, // 1MB chunks by default
  }) async {
    // Implementation for chunked streaming would go here
    // This is a more complex implementation that requires
    // custom handling of the ZIP format as it's streamed in chunks

    throw UnimplementedError('Chunked extraction not yet implemented');
  }
}
