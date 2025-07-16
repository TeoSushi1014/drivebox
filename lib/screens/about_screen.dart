import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About DriveBox')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: CircleAvatar(
                radius: 60,
                backgroundColor: Colors.blue.shade100,
                child: Icon(
                  Icons.drive_folder_upload,
                  size: 60,
                  color: Colors.blue.shade700,
                ),
              ),
            ),
            const SizedBox(height: 32),
            Center(
              child: Text(
                'DriveBox',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
            ),
            Center(
              child: Text(
                'Version 1.0.0',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: Colors.grey.shade700),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'DriveBox is a Flutter Desktop application for downloading and installing driving simulation software. It manages the installation of dependencies and application files, ensuring a smooth user experience.',
              style: TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            const Text(
              'Developer',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            _buildContactItem(
              context,
              icon: Icons.person,
              label: 'Hoang Viet Quang (TeoSushi)',
              onTap: null,
            ),
            _buildContactItem(
              context,
              icon: Icons.facebook,
              label: 'Facebook',
              onTap: () =>
                  _launchURL('https://www.facebook.com/boboiboy.gala.7/'),
            ),
            _buildContactItem(
              context,
              icon: Icons.code,
              label: 'GitHub (Project)',
              onTap: () =>
                  _launchURL('https://github.com/TeoSushi1014/drivebox'),
            ),
            _buildContactItem(
              context,
              icon: Icons.phone,
              label: 'Zalo (Support): 0838696697',
              onTap: null,
            ),
            const SizedBox(height: 48),
            const Text(
              'Security Notice',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            const Card(
              color: Color(0xFFFFEECC),
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.security, color: Colors.orange),
                        SizedBox(width: 8),
                        Text(
                          'Windows Security Warning',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Windows Defender or your antivirus may show warnings when downloading or installing applications through DriveBox. This is normal as the application is not code-signed.\n\nTo bypass these warnings, click "More Info" and then "Run Anyway" when prompted.',
                      style: TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContactItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: Colors.blue),
      title: Text(label),
      onTap: onTap,
      trailing: onTap != null ? const Icon(Icons.open_in_new) : null,
    );
  }

  Future<void> _launchURL(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      throw 'Could not launch $url';
    }
  }
}
