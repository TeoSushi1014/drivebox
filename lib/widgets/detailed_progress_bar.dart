import 'package:flutter/material.dart';
import 'package:filesize/filesize.dart';

class DetailedProgressBar extends StatelessWidget {
  final double progress;
  final String status;
  final String currentFile;
  final int? downloadedBytes;
  final int? totalBytes;

  const DetailedProgressBar({
    Key? key,
    required this.progress,
    required this.status,
    required this.currentFile,
    this.downloadedBytes,
    this.totalBytes,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(status, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('${(progress * 100).toStringAsFixed(1)}%'),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 16,
            backgroundColor: Colors.grey.shade200,
            valueColor: AlwaysStoppedAnimation<Color>(
              _getColorForStatus(status),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          currentFile,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
        ),
        if (downloadedBytes != null && status.toLowerCase() == 'resuming')
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Resuming from ${filesize(downloadedBytes)}',
              style: TextStyle(
                color: Colors.blue.shade700,
                fontSize: 12,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
        if (downloadedBytes != null && totalBytes != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              '${filesize(downloadedBytes)} of ${filesize(totalBytes)}',
              style: TextStyle(color: Colors.grey.shade700, fontSize: 12),
            ),
          ),
      ],
    );
  }

  Color _getColorForStatus(String status) {
    switch (status.toLowerCase()) {
      case 'downloading':
        return Colors.blue;
      case 'resuming':
        return Colors.lightBlue;
      case 'validating':
        return Colors.amber;
      case 'installing':
      case 'installingdependencies':
        return Colors.orange;
      case 'extracting':
        return Colors.purple;
      case 'completed':
        return Colors.green;
      case 'failed':
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.blue;
    }
  }
}
