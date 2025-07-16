import 'package:filesize/filesize.dart';
import 'package:flutter/material.dart';
import '../models/application_model.dart';

class ApplicationCard extends StatelessWidget {
  final ApplicationModel application;
  final bool isInstalled;
  final VoidCallback onInstall;
  final VoidCallback onLaunch;
  final VoidCallback onUninstall;

  const ApplicationCard({
    Key? key,
    required this.application,
    required this.isInstalled,
    required this.onInstall,
    required this.onLaunch,
    required this.onUninstall,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Convert to bytes for the filesize function
    final sizeInBytes = (application.totalSizeGB * 1024 * 1024 * 1024).round();

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    application.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isInstalled ? Colors.green : Colors.blue,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    isInstalled ? 'Installed' : 'Available',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              application.description,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.info_outline, size: 16),
                const SizedBox(width: 8),
                Text('Version: ${application.version}'),
                const SizedBox(width: 16),
                const Icon(Icons.storage, size: 16),
                const SizedBox(width: 8),
                // Display the size using the filesize package for human-readable format
                Text('Size: ${filesize(sizeInBytes)}'),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (isInstalled) ...[
                  ElevatedButton.icon(
                    onPressed: onLaunch,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Launch'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: onUninstall,
                    icon: const Icon(Icons.delete),
                    label: const Text('Uninstall'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                    ),
                  ),
                ] else ...[
                  ElevatedButton.icon(
                    onPressed: onInstall,
                    icon: const Icon(Icons.download),
                    label: const Text('Install'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.blue,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
