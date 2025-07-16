enum ModuleType { dependencyInstaller, appFiles }

class ModuleModel {
  final String id;
  final String name;
  final ModuleType type;
  final String url;
  final String checksumSha256;

  ModuleModel({
    required this.id,
    required this.name,
    required this.type,
    required this.url,
    required this.checksumSha256,
  });

  factory ModuleModel.fromJson(Map<String, dynamic> json) {
    ModuleType moduleType;
    switch (json['type']) {
      case 'dependency_installer':
        moduleType = ModuleType.dependencyInstaller;
        break;
      case 'app_files':
        moduleType = ModuleType.appFiles;
        break;
      default:
        throw Exception('Unknown module type: ${json['type']}');
    }

    return ModuleModel(
      id: json['id'] as String,
      name: json['name'] as String,
      type: moduleType,
      url: json['url'] as String,
      checksumSha256: json['checksum_sha256'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    String typeString;
    switch (type) {
      case ModuleType.dependencyInstaller:
        typeString = 'dependency_installer';
        break;
      case ModuleType.appFiles:
        typeString = 'app_files';
        break;
    }

    return {
      'id': id,
      'name': name,
      'type': typeString,
      'url': url,
      'checksum_sha256': checksumSha256,
    };
  }
}
