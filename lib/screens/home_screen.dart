import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../blocs/app_state_bloc.dart';
import '../widgets/application_card.dart';
import '../widgets/detailed_progress_bar.dart';
import 'about_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('DriveBox'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              context.read<AppBloc>().add(LoadApplicationsEvent());
            },
            tooltip: 'Refresh',
          ),
          IconButton(
            icon: const Icon(Icons.info),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const AboutScreen()),
              );
            },
            tooltip: 'About',
          ),
        ],
      ),
      body: BlocConsumer<AppBloc, AppState>(
        listener: (context, state) {
          if (state is InstallationCompleteState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  '${state.application.name} installed successfully!',
                ),
                behavior: SnackBarBehavior.floating,
              ),
            );
          } else if (state is InstallationErrorState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Error: ${state.error}'),
                backgroundColor: Colors.red,
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is LoadingAppsState) {
            return const Center(child: CircularProgressIndicator());
          } else if (state is AppsLoadErrorState) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 60, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    'Error loading applications',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(state.error),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () {
                      context.read<AppBloc>().add(LoadApplicationsEvent());
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          } else if (state is AppsLoadedState) {
            if (state.applications.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.app_blocking,
                      size: 60,
                      color: Colors.grey,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No applications available',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ],
                ),
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: state.applications.length,
              itemBuilder: (context, index) {
                final app = state.applications[index];
                final isInstalled = state.installedStatus[app.id] ?? false;

                return ApplicationCard(
                  application: app,
                  isInstalled: isInstalled,
                  onInstall: () {
                    context.read<AppBloc>().add(InstallApplicationEvent(app));
                  },
                  onLaunch: () {
                    context.read<AppBloc>().add(LaunchApplicationEvent(app));
                  },
                  onUninstall: () {
                    showDialog(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Confirm Uninstall'),
                        content: Text(
                          'Are you sure you want to uninstall ${app.name}?',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel'),
                          ),
                          TextButton(
                            onPressed: () {
                              Navigator.pop(context);
                              context.read<AppBloc>().add(
                                UninstallApplicationEvent(app),
                              );
                            },
                            child: const Text('Uninstall'),
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            );
          } else if (state is InstallingState) {
            return Column(
              children: [
                AppBar(
                  title: Text('Installing ${state.application.name}'),
                  automaticallyImplyLeading: false,
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          state.progress.message,
                          style: Theme.of(context).textTheme.titleLarge,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 32),
                        DetailedProgressBar(
                          progress: state.progress.progress,
                          status: state.progress.status
                              .toString()
                              .split('.')
                              .last,
                          currentFile: state.progress.currentFile,
                          downloadedBytes: state.progress.downloadedBytes,
                          totalBytes: state.progress.totalBytes,
                        ),
                        const SizedBox(height: 48),
                        if (state.progress.error != null)
                          Text(
                            'Error: ${state.progress.error}',
                            style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          } else {
            return const Center(child: CircularProgressIndicator());
          }
        },
      ),
    );
  }
}
