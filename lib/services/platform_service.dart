import 'dart:ffi';
import 'package:ffi/ffi.dart';
import 'package:win32/win32.dart';

class PlatformService {
  // Check if a Registry key exists
  bool registryKeyExists(int key, String subKey) {
    final hKey = calloc<HANDLE>();

    try {
      // Try to open the key
      final result = RegOpenKeyEx(
        key, // HKEY
        subKey.toNativeUtf16(), // lpSubKey
        0, // ulOptions
        KEY_READ, // samDesired
        hKey, // phkResult
      );

      if (result == ERROR_SUCCESS) {
        RegCloseKey(hKey.value);
        return true;
      } else {
        return false;
      }
    } finally {
      calloc.free(hKey);
    }
  }

  // Check if VC++ redistributable is installed
  bool isVCRedistInstalled() {
    // Check for VC++ 2017 Redistributable (x64)
    return registryKeyExists(
      HKEY_LOCAL_MACHINE,
      r'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
    );
  }

  // Check if a software is installed by looking for its uninstall entry
  bool isSoftwareInstalled(String displayName) {
    final keyPaths = [
      r'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
      r'SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
    ];

    for (final keyPath in keyPaths) {
      final hKey = calloc<HANDLE>();

      if (RegOpenKeyEx(
            HKEY_LOCAL_MACHINE,
            keyPath.toNativeUtf16(),
            0,
            KEY_READ,
            hKey,
          ) ==
          ERROR_SUCCESS) {
        try {
          int index = 0;
          final nameBuffer = calloc<Uint16>(256).cast<Utf16>();
          final nameSize = calloc<DWORD>();
          nameSize.value = 256;

          while (RegEnumKeyEx(
                hKey.value,
                index,
                nameBuffer,
                nameSize,
                nullptr,
                nullptr,
                nullptr,
                nullptr,
              ) ==
              ERROR_SUCCESS) {
            final subKeyName = nameBuffer.toDartString();
            final subKey = '$keyPath\\$subKeyName';

            final displayNameValue = getRegistryStringValue(
              HKEY_LOCAL_MACHINE,
              subKey,
              'DisplayName',
            );

            if (displayNameValue != null &&
                displayNameValue.contains(displayName)) {
              return true;
            }

            index++;
            nameSize.value = 256;
          }
        } finally {
          RegCloseKey(hKey.value);
          calloc.free(hKey);
        }
      }
    }

    return false;
  }

  // Get a string value from the registry
  String? getRegistryStringValue(int hKey, String keyPath, String valueName) {
    final hSubKey = calloc<HANDLE>();

    if (RegOpenKeyEx(hKey, keyPath.toNativeUtf16(), 0, KEY_READ, hSubKey) !=
        ERROR_SUCCESS) {
      calloc.free(hSubKey);
      return null;
    }

    final type = calloc<DWORD>();
    final dataSize = calloc<DWORD>();

    // Get the size of the data
    if (RegQueryValueEx(
          hSubKey.value,
          valueName.toNativeUtf16(),
          nullptr,
          type,
          nullptr,
          dataSize,
        ) !=
        ERROR_SUCCESS) {
      RegCloseKey(hSubKey.value);
      calloc.free(hSubKey);
      calloc.free(type);
      calloc.free(dataSize);
      return null;
    }

    // Only proceed if the type is string (REG_SZ)
    if (type.value != REG_SZ) {
      RegCloseKey(hSubKey.value);
      calloc.free(hSubKey);
      calloc.free(type);
      calloc.free(dataSize);
      return null;
    }

    final data = calloc<Uint8>(dataSize.value);

    if (RegQueryValueEx(
          hSubKey.value,
          valueName.toNativeUtf16(),
          nullptr,
          type,
          data,
          dataSize,
        ) !=
        ERROR_SUCCESS) {
      RegCloseKey(hSubKey.value);
      calloc.free(hSubKey);
      calloc.free(type);
      calloc.free(dataSize);
      calloc.free(data);
      return null;
    }

    final result = data.cast<Utf16>().toDartString();

    RegCloseKey(hSubKey.value);
    calloc.free(hSubKey);
    calloc.free(type);
    calloc.free(dataSize);
    calloc.free(data);

    return result;
  }
}
