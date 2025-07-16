import 'dart:io';

class ProcessService {
  // Run an external process with the given arguments and wait for it to complete
  Future<ProcessResult> runProcess(
    String executable,
    List<String> arguments, {
    String? workingDirectory,
  }) async {
    try {
      final result = await Process.run(
        executable,
        arguments,
        workingDirectory: workingDirectory,
      );

      if (result.exitCode != 0) {
        throw Exception(
          'Process exited with code ${result.exitCode}: ${result.stderr}',
        );
      }

      return result;
    } catch (e) {
      throw Exception('Failed to run process: $e');
    }
  }

  // Run a Windows executable with silent installation arguments
  Future<ProcessResult> runSilentInstaller(String executablePath) async {
    final args = ['/quiet', '/norestart'];
    return runProcess(executablePath, args);
  }

  // Launch an application
  Future<Process> launchApplication(
    String executablePath, {
    List<String>? arguments,
  }) {
    return Process.start(
      executablePath,
      arguments ?? [],
      mode: ProcessStartMode.detached,
    );
  }
}
