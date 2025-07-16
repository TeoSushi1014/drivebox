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
      totalSize = json['totalSize_gb'].toDouble();
    } else if (json.containsKey('totalSize_mb')) {
      totalSize = json['totalSize_mb'].toDouble() / 1024; // Convert MB to GB
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
    return {
      'id': id,
      'name': name,
      'description': description,
      'version': version,
      'totalSize_gb': totalSizeGB,
      'installDir': installDir,
      'modules': modules.map((module) => module.toJson()).toList(),
    };
  }
}
