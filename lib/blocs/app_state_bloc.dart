import 'package:flutter_bloc/flutter_bloc.dart';
import '../models/application_model.dart';
import '../services/installation_service.dart';
import '../services/manifest_service.dart';

// Events
abstract class AppEvent {}

class LoadApplicationsEvent extends AppEvent {}

class InstallApplicationEvent extends AppEvent {
  final ApplicationModel application;

  InstallApplicationEvent(this.application);
}

class LaunchApplicationEvent extends AppEvent {
  final ApplicationModel application;

  LaunchApplicationEvent(this.application);
}

class UninstallApplicationEvent extends AppEvent {
  final ApplicationModel application;

  UninstallApplicationEvent(this.application);
}

// States
abstract class AppState {}

class InitialAppState extends AppState {}

class LoadingAppsState extends AppState {}

class AppsLoadedState extends AppState {
  final List<ApplicationModel> applications;
  final Map<String, bool> installedStatus;

  AppsLoadedState(this.applications, this.installedStatus);
}

class AppsLoadErrorState extends AppState {
  final String error;

  AppsLoadErrorState(this.error);
}

class InstallingState extends AppState {
  final ApplicationModel application;
  final InstallationProgress progress;

  InstallingState(this.application, this.progress);
}

class InstallationCompleteState extends AppState {
  final ApplicationModel application;

  InstallationCompleteState(this.application);
}

class InstallationErrorState extends AppState {
  final ApplicationModel application;
  final String error;

  InstallationErrorState(this.application, this.error);
}

class LaunchingState extends AppState {
  final ApplicationModel application;

  LaunchingState(this.application);
}

class UninstallingState extends AppState {
  final ApplicationModel application;

  UninstallingState(this.application);
}

// BLoC
class AppBloc extends Bloc<AppEvent, AppState> {
  final ManifestService _manifestService = ManifestService();
  final InstallationService _installationService = InstallationService();

  List<ApplicationModel> _applications = [];
  Map<String, bool> _installedStatus = {};

  AppBloc() : super(InitialAppState()) {
    on<LoadApplicationsEvent>(_onLoadApplications);
    on<InstallApplicationEvent>(_onInstallApplication);
    on<LaunchApplicationEvent>(_onLaunchApplication);
    on<UninstallApplicationEvent>(_onUninstallApplication);
  }

  Future<void> _onLoadApplications(
    LoadApplicationsEvent event,
    Emitter<AppState> emit,
  ) async {
    try {
      emit(LoadingAppsState());

      // Load applications from the manifest
      _applications = await _manifestService.fetchManifest();

      // Check installation status for each application
      _installedStatus = {};
      for (final app in _applications) {
        final isInstalled = await _installationService.isApplicationInstalled(
          app,
        );
        _installedStatus[app.id] = isInstalled;
      }

      emit(AppsLoadedState(_applications, _installedStatus));
    } catch (e) {
      emit(AppsLoadErrorState(e.toString()));
    }
  }

  Future<void> _onInstallApplication(
    InstallApplicationEvent event,
    Emitter<AppState> emit,
  ) async {
    try {
      // Start installation
      await _installationService.installApplication(event.application, (
        progress,
      ) {
        emit(InstallingState(event.application, progress));
      });

      // Update installed status
      _installedStatus[event.application.id] = true;

      emit(InstallationCompleteState(event.application));
      emit(AppsLoadedState(_applications, _installedStatus));
    } catch (e) {
      emit(InstallationErrorState(event.application, e.toString()));
      emit(AppsLoadedState(_applications, _installedStatus));
    }
  }

  Future<void> _onLaunchApplication(
    LaunchApplicationEvent event,
    Emitter<AppState> emit,
  ) async {
    try {
      emit(LaunchingState(event.application));
      await _installationService.launchApplication(event.application);
      emit(AppsLoadedState(_applications, _installedStatus));
    } catch (e) {
      emit(InstallationErrorState(event.application, e.toString()));
      emit(AppsLoadedState(_applications, _installedStatus));
    }
  }

  Future<void> _onUninstallApplication(
    UninstallApplicationEvent event,
    Emitter<AppState> emit,
  ) async {
    try {
      emit(UninstallingState(event.application));
      await _installationService.uninstallApplication(event.application);

      // Update installed status
      _installedStatus[event.application.id] = false;

      emit(AppsLoadedState(_applications, _installedStatus));
    } catch (e) {
      emit(InstallationErrorState(event.application, e.toString()));
      emit(AppsLoadedState(_applications, _installedStatus));
    }
  }
}
