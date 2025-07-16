import 'module_model.dart';

class ApplicationModel {
  final String id;
  final String name;
  final String description;
  final String version;
  double sizeValue; // Removed final to allow updating from GitHub
  String sizeUnit; // Removed final to allow updating from GitHub
  final String installDir;
  final List<ModuleModel> modules;

  ApplicationModel({
    required this.id,
    required this.name,
    required this.description,
    required this.version,
    required this.sizeValue,
    required this.sizeUnit,
    required this.installDir,
    required this.modules,
  });

  // Getter for backward compatibility
  double get totalSizeGB => sizeUnit == 'GB' ? sizeValue : sizeValue / 1024;

  factory ApplicationModel.fromJson(Map<String, dynamic> json) {
    // Parse the totalSize which could be in GB or MB
    double sizeValue = 0;
    String sizeUnit = 'GB'; // Default unit

    if (json.containsKey('totalSize_gb')) {
      // Keep as GB
      sizeValue = double.parse(json['totalSize_gb'].toString());
      sizeUnit = 'GB';
    } else if (json.containsKey('totalSize_mb')) {
      // Keep as MB
      sizeValue = double.parse(json['totalSize_mb'].toString());
      sizeUnit = 'MB';
    } else {
      // Calculate total size from modules if not specified
      var modules = json['modules'] as List;
      // For now we'll just use a default size as module sizes are not in the JSON
      sizeValue = modules.length * 500; // Estimate 500MB per module
      sizeUnit = 'MB';
    }

    return ApplicationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      version: json['version'] as String,
      sizeValue: sizeValue,
      sizeUnit: sizeUnit,
      installDir: json['installDir'] as String,
      modules: (json['modules'] as List)
          .map((moduleJson) => ModuleModel.fromJson(moduleJson))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    // Use the correct size key based on the stored unit
    final sizeKey = sizeUnit == 'GB' ? 'totalSize_gb' : 'totalSize_mb';

    return {
      'id': id,
      'name': name,
      'description': description,
      'version': version,
      sizeKey: sizeValue,
      'installDir': installDir,
      'modules': modules.map((module) => module.toJson()).toList(),
    };
  }
}
