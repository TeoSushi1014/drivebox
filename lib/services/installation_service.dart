import 'dart:io';
import 'package:path/path.dart' as path;
import 'package:path_provider/path_provider.dart';
import '../models/application_model.dart';
import '../models/module_model.dart';
import 'file_service.dart';
import 'process_service.dart';
import 'platform_service.dart';

enum InstallationStatus {
  notStarted,
  downloading,
  validating,
  installing,
  installingDependencies,
  extracting,
  completed,
  failed,
  cancelled,
}

class InstallationProgress {
  final InstallationStatus status;
  final double progress; // 0.0 to 1.0
  final String currentFile;
  final String message;
  final String? error;

  InstallationProgress({
    required this.status,
    required this.progress,
    required this.currentFile,
    required this.message,
    this.error,
  });
}

class InstallationService {
  final FileService _fileService = FileService();
  final ProcessService _processService = ProcessService();
  final PlatformService _platformService = PlatformService();

  // Get the installation directory path
  Future<String> getInstallationPath(String appDirName) async {
    final documentsDir = await getApplicationDocumentsDirectory();
    return path.join(documentsDir.path, appDirName);
  }

  // Install an application
  Future<void> installApplication(
    ApplicationModel app,
    void Function(InstallationProgress) onProgressUpdate,
  ) async {
    try {
      // Create the installation directory
      final installationPath = await getInstallationPath(app.installDir);
      final installDir = Directory(installationPath);

      if (!installDir.existsSync()) {
        await installDir.create(recursive: true);
      }

      // Group modules by type
      final dependencyInstallers = app.modules
          .where((m) => m.type == ModuleType.dependencyInstaller)
          .toList();

      final appFiles = app.modules
          .where((m) => m.type == ModuleType.appFiles)
          .toList();

      // Process dependency installers first
      if (dependencyInstallers.isNotEmpty) {
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.installingDependencies,
            progress: 0.0,
            currentFile: 'Checking dependencies',
            message: 'Verifying system dependencies...',
          ),
        );

        await _processDependencyInstallers(
          dependencyInstallers,
          onProgressUpdate,
        );
      }

      // Then process app files
      if (appFiles.isNotEmpty) {
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.extracting,
            progress: 0.0,
            currentFile: 'Preparing application files',
            message: 'Extracting application files...',
          ),
        );

        await _processAppFiles(appFiles, installationPath, onProgressUpdate);
      }

      // Clean up temp directory
      await _fileService.cleanupTempDir();

      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.completed,
          progress: 1.0,
          currentFile: '',
          message: 'Installation completed successfully!',
        ),
      );
    } catch (e) {
      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.failed,
          progress: 0.0,
          currentFile: '',
          message: 'Installation failed',
          error: e.toString(),
        ),
      );
      rethrow;
    }
  }

  // Process dependency installers
  Future<void> _processDependencyInstallers(
    List<ModuleModel> dependencyInstallers,
    void Function(InstallationProgress) onProgressUpdate,
  ) async {
    final totalDependencies = dependencyInstallers.length;
    var processedDependencies = 0;

    for (final module in dependencyInstallers) {
      // Update progress
      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.installingDependencies,
          progress: processedDependencies / totalDependencies,
          currentFile: module.name,
          message: 'Installing dependency: ${module.name}',
        ),
      );

      // Check if the dependency is already installed
      bool isDependencyInstalled = false;

      if (module.id.contains('vc_redist')) {
        isDependencyInstalled = _platformService.isVCRedistInstalled();
      } else if (module.id.contains('klite')) {
        isDependencyInstalled = _platformService.isSoftwareInstalled(
          'K-Lite Codec Pack',
        );
      }

      if (isDependencyInstalled) {
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.installingDependencies,
            progress: (processedDependencies + 0.5) / totalDependencies,
            currentFile: module.name,
            message: '${module.name} is already installed.',
          ),
        );
      } else {
        // Download dependency installer
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.downloading,
            progress: processedDependencies / totalDependencies,
            currentFile: module.name,
            message: 'Downloading ${module.name}...',
          ),
        );

        final fileName = '${module.id}.zip';
        final downloadedFile = await _fileService.downloadFile(
          url: module.url,
          fileName: fileName,
          onProgress: (progress) {
            onProgressUpdate(
              InstallationProgress(
                status: InstallationStatus.downloading,
                progress:
                    (processedDependencies + progress * 0.4) /
                    totalDependencies,
                currentFile: module.name,
                message:
                    'Downloading ${module.name}: ${(progress * 100).toStringAsFixed(1)}%',
              ),
            );
          },
        );

        // Validate checksum
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.validating,
            progress: (processedDependencies + 0.4) / totalDependencies,
            currentFile: module.name,
            message: 'Validating ${module.name}...',
          ),
        );

        final isValid = await _fileService.validateChecksum(
          downloadedFile,
          module.checksumSha256,
        );

        if (!isValid) {
          throw Exception('Checksum validation failed for ${module.name}');
        }

        // Extract installer
        final tempDir = await _fileService.getTempDir();
        final extractionDir = path.join(tempDir.path, module.id);

        await _fileService.extractZip(downloadedFile, extractionDir);

        // Find the executable in the extracted directory
        final extractedDir = Directory(extractionDir);
        final exeFiles = await extractedDir
            .list()
            .where(
              (entity) =>
                  entity is File && entity.path.toLowerCase().endsWith('.exe'),
            )
            .cast<File>()
            .toList();

        if (exeFiles.isEmpty) {
          throw Exception(
            'No executable found in the extracted dependency installer',
          );
        }

        // Run installer silently
        onProgressUpdate(
          InstallationProgress(
            status: InstallationStatus.installing,
            progress: (processedDependencies + 0.6) / totalDependencies,
            currentFile: module.name,
            message: 'Installing ${module.name}...',
          ),
        );

        await _processService.runSilentInstaller(exeFiles.first.path);
      }

      processedDependencies++;
    }
  }

  // Process application files
  Future<void> _processAppFiles(
    List<ModuleModel> appFiles,
    String installationPath,
    void Function(InstallationProgress) onProgressUpdate,
  ) async {
    final totalModules = appFiles.length;
    var processedModules = 0;

    for (final module in appFiles) {
      // Update progress
      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.downloading,
          progress: processedModules / totalModules,
          currentFile: module.name,
          message: 'Downloading ${module.name}...',
        ),
      );

      final fileName = '${module.id}.zip';
      final downloadedFile = await _fileService.downloadFile(
        url: module.url,
        fileName: fileName,
        onProgress: (progress) {
          onProgressUpdate(
            InstallationProgress(
              status: InstallationStatus.downloading,
              progress: (processedModules + progress * 0.6) / totalModules,
              currentFile: module.name,
              message:
                  'Downloading ${module.name}: ${(progress * 100).toStringAsFixed(1)}%',
            ),
          );
        },
      );

      // Validate checksum
      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.validating,
          progress: (processedModules + 0.6) / totalModules,
          currentFile: module.name,
          message: 'Validating ${module.name}...',
        ),
      );

      final isValid = await _fileService.validateChecksum(
        downloadedFile,
        module.checksumSha256,
      );

      if (!isValid) {
        throw Exception('Checksum validation failed for ${module.name}');
      }

      // Extract files
      onProgressUpdate(
        InstallationProgress(
          status: InstallationStatus.extracting,
          progress: (processedModules + 0.7) / totalModules,
          currentFile: module.name,
          message: 'Extracting ${module.name}...',
        ),
      );

      await _fileService.extractZip(downloadedFile, installationPath);

      processedModules++;
    }
  }

  // Launch an installed application
  Future<void> launchApplication(ApplicationModel app) async {
    final installPath = await getInstallationPath(app.installDir);
    final exeFiles = await Directory(installPath)
        .list(recursive: true)
        .where(
          (entity) =>
              entity is File && entity.path.toLowerCase().endsWith('.exe'),
        )
        .cast<File>()
        .toList();

    if (exeFiles.isEmpty) {
      throw Exception('No executable found in the installation directory');
    }

    // Find the main executable (typically not an installer or uninstaller)
    final mainExe = exeFiles.firstWhere(
      (file) =>
          !file.path.toLowerCase().contains('install') &&
          !file.path.toLowerCase().contains('uninstall'),
      orElse: () => exeFiles.first,
    );

    await _processService.launchApplication(mainExe.path);
  }

  // Uninstall an application
  Future<void> uninstallApplication(ApplicationModel app) async {
    final installPath = await getInstallationPath(app.installDir);
    final installDir = Directory(installPath);

    if (installDir.existsSync()) {
      await installDir.delete(recursive: true);
    }
  }

  // Check if an application is installed
  Future<bool> isApplicationInstalled(ApplicationModel app) async {
    final installPath = await getInstallationPath(app.installDir);
    final installDir = Directory(installPath);

    if (!installDir.existsSync()) {
      return false;
    }

    // Check if the directory has contents
    final contents = await installDir.list().toList();
    return contents.isNotEmpty;
  }
}
