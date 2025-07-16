import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'blocs/app_state_bloc.dart';
import 'screens/home_screen.dart';
import 'services/update_service.dart';
import 'services/manifest_service.dart';
import 'dart:async';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const DriveBoxApp());
}

class DriveBoxApp extends StatefulWidget {
  const DriveBoxApp({super.key});

  @override
  State<DriveBoxApp> createState() => _DriveBoxAppState();
}

class _DriveBoxAppState extends State<DriveBoxApp> {
  final UpdateService _updateService = UpdateService();

  @override
  void initState() {
    super.initState();
    // Check for updates after a short delay to allow the app to load
    Timer(const Duration(seconds: 2), _checkForUpdates);
  }

  Future<void> _checkForUpdates() async {
    final updateInfo = await _updateService.checkForUpdates();

    if (updateInfo != null && mounted) {
      // Show update dialog
      showDialog(
        context: context,
        barrierDismissible: !updateInfo.isRequired,
        builder: (context) => AlertDialog(
          title: const Text('Update Available'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Version ${updateInfo.version} is now available.'),
                const SizedBox(height: 16),
                const Text('Release Notes:'),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceVariant,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(updateInfo.releaseNotes),
                ),
              ],
            ),
          ),
          actions: [
            if (!updateInfo.isRequired)
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Later'),
              ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                _updateService.downloadAndApplyUpdate(updateInfo);
              },
              child: const Text('Update Now'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => AppBloc()..add(LoadApplicationsEvent()),
      child: MaterialApp(
        navigatorKey: navigatorKey, // Use the global navigatorKey
        title: 'DriveBox',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.light,
          ),
        ),
        darkTheme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: Colors.blue,
            brightness: Brightness.dark,
          ),
        ),
        themeMode: ThemeMode.system,
        home: const HomeScreen(),
      ),
    );
  }
}
