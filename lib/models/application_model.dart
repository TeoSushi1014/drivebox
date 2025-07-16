import 'module_model.dart';

class ApplicationModel {
  final String id;
  final String name;
  final String description;
  final String version;
  final double totalSizeGB;
  final String installDir;
  final List<ModuleModel> modules;

  ApplicationModel({
    required this.id,
    required this.name,
    required this.description,
    required this.version,
    required this.totalSizeGB,
    required this.installDir,
    required this.modules,
  });

  factory ApplicationModel.fromJson(Map<String, dynamic> json) {
    // Parse the totalSize which could be in GB or MB
    double totalSize = 0;

    if (json.containsKey('totalSize_gb')) {
      // Convert to double in case it's an int in the JSON
      totalSize = double.parse(json['totalSize_gb'].toString());
    } else if (json.containsKey('totalSize_mb')) {
      // Convert MB to GB
      totalSize = double.parse(json['totalSize_mb'].toString()) / 1024;
    } else {
      // Calculate total size from modules if not specified
      var modules = json['modules'] as List;
      // For now we'll just use a default size as module sizes are not in the JSON
      totalSize = modules.length * 0.5; // Estimate 500MB per module
    }

    return ApplicationModel(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      version: json['version'] as String,
      totalSizeGB: totalSize,
      installDir: json['installDir'] as String,
      modules: (json['modules'] as List)
          .map((moduleJson) => ModuleModel.fromJson(moduleJson))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    // Determine whether to use totalSize_gb or totalSize_mb based on size
    final sizeKey = totalSizeGB >= 1 ? 'totalSize_gb' : 'totalSize_mb';
    final sizeValue = totalSizeGB >= 1 ? totalSizeGB : totalSizeGB * 1024;

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
