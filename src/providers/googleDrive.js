const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');
const SecurityManager = require('../utils/security');

class GoogleDriveProvider {
  constructor(credentials) {
    this.auth = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );
    
    if (credentials.refreshToken) {
      this.auth.setCredentials({
        refresh_token: credentials.refreshToken,
        access_token: credentials.accessToken
      });
    }
    
    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.security = new SecurityManager();
    this.pageToken = null;
    this.rootFolderId = 'root';
  }

  // Authenticate with Google Drive
  async authenticate(authCode) {
    try {
      const { tokens } = await this.auth.getToken(authCode);
      this.auth.setCredentials(tokens);
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date
      };
    } catch (error) {
      console.error('Google Drive authentication failed:', error);
      throw error;
    }
  }

  // Get authorization URL
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.metadata'
    ];
    
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Upload file to Google Drive
  async uploadFile(localPath, remotePath) {
    try {
      const fileName = path.basename(remotePath);
      const parentFolder = await this.ensureFolderPath(path.dirname(remotePath));
      
      // Check if file already exists
      const existingFile = await this.findFile(fileName, parentFolder.id);
      
      const fileMetadata = {
        name: fileName,
        parents: [parentFolder.id]
      };
      
      const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(localPath)
      };
      
      let result;
      if (existingFile) {
        // Update existing file
        result = await this.drive.files.update({
          fileId: existingFile.id,
          media: media,
          fields: 'id, name, size, modifiedTime, md5Checksum'
        });
      } else {
        // Create new file
        result = await this.drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id, name, size, modifiedTime, md5Checksum'
        });
      }
      
      console.log(`File uploaded to Google Drive: ${fileName}`);
      return result.data;
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      throw error;
    }
  }

  // Download file from Google Drive
  async downloadFile(remotePath, localPath) {
    try {
      const fileName = path.basename(remotePath);
      const parentFolder = await this.findFolderByPath(path.dirname(remotePath));
      
      if (!parentFolder) {
        throw new Error(`Folder not found: ${path.dirname(remotePath)}`);
      }
      
      const file = await this.findFile(fileName, parentFolder.id);
      if (!file) {
        throw new Error(`File not found: ${remotePath}`);
      }
      
      const dest = fs.createWriteStream(localPath);
      const response = await this.drive.files.get({
        fileId: file.id,
        alt: 'media'
      }, { responseType: 'stream' });
      
      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => {
            console.log(`File downloaded from Google Drive: ${fileName}`);
            resolve();
          })
          .on('error', reject)
          .pipe(dest);
      });
    } catch (error) {
      console.error('Google Drive download failed:', error);
      throw error;
    }
  }

  // Delete file from Google Drive
  async deleteFile(remotePath) {
    try {
      const fileName = path.basename(remotePath);
      const parentFolder = await this.findFolderByPath(path.dirname(remotePath));
      
      if (!parentFolder) {
        console.log(`Folder not found, cannot delete: ${remotePath}`);
        return;
      }
      
      const file = await this.findFile(fileName, parentFolder.id);
      if (!file) {
        console.log(`File not found, cannot delete: ${remotePath}`);
        return;
      }
      
      await this.drive.files.delete({
        fileId: file.id
      });
      
      console.log(`File deleted from Google Drive: ${fileName}`);
    } catch (error) {
      console.error('Google Drive delete failed:', error);
      throw error;
    }
  }

  // Create folder
  async createFolder(folderPath) {
    try {
      return await this.ensureFolderPath(folderPath);
    } catch (error) {
      console.error('Google Drive folder creation failed:', error);
      throw error;
    }
  }

  // Delete folder
  async deleteFolder(folderPath) {
    try {
      const folder = await this.findFolderByPath(folderPath);
      if (!folder) {
        console.log(`Folder not found, cannot delete: ${folderPath}`);
        return;
      }
      
      await this.drive.files.delete({
        fileId: folder.id
      });
      
      console.log(`Folder deleted from Google Drive: ${folderPath}`);
    } catch (error) {
      console.error('Google Drive folder deletion failed:', error);
      throw error;
    }
  }

  // List all files
  async listFiles(folderId = this.rootFolderId) {
    try {
      const files = [];
      let pageToken = null;
      
      do {
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, size, modifiedTime, md5Checksum, mimeType, parents)',
          pageSize: 1000,
          pageToken: pageToken
        });
        
        for (const file of response.data.files) {
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            // Recursively list folder contents
            const subFiles = await this.listFiles(file.id);
            files.push(...subFiles.map(f => ({
              ...f,
              path: `${file.name}/${f.path}`
            })));
          } else {
            files.push({
              id: file.id,
              path: file.name,
              size: parseInt(file.size) || 0,
              modified: new Date(file.modifiedTime).getTime(),
              hash: file.md5Checksum,
              mimeType: file.mimeType
            });
          }
        }
        
        pageToken = response.data.nextPageToken;
      } while (pageToken);
      
      return files;
    } catch (error) {
      console.error('Google Drive list files failed:', error);
      throw error;
    }
  }

  // Get changes since last sync
  async getChanges() {
    try {
      const changes = [];
      let pageToken = this.pageToken;
      
      // Get start page token if we don't have one
      if (!pageToken) {
        const response = await this.drive.changes.getStartPageToken();
        pageToken = response.data.startPageToken;
        this.pageToken = pageToken;
        return changes; // No changes on first run
      }
      
      let hasMore = true;
      while (hasMore) {
        const response = await this.drive.changes.list({
          pageToken: pageToken,
          fields: 'nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, size, modifiedTime, md5Checksum, parents, trashed))'
        });
        
        for (const change of response.data.changes) {
          if (change.removed || change.file.trashed) {
            changes.push({
              event: 'delete',
              fileId: change.fileId,
              path: await this.getFilePath(change.fileId)
            });
          } else {
            const filePath = await this.getFilePath(change.file.id);
            changes.push({
              event: 'change',
              fileId: change.file.id,
              path: filePath,
              size: parseInt(change.file.size) || 0,
              modified: new Date(change.file.modifiedTime).getTime(),
              hash: change.file.md5Checksum
            });
          }
        }
        
        if (response.data.newStartPageToken) {
          this.pageToken = response.data.newStartPageToken;
          hasMore = false;
        } else {
          pageToken = response.data.nextPageToken;
        }
      }
      
      return changes;
    } catch (error) {
      console.error('Google Drive get changes failed:', error);
      throw error;
    }
  }

  // Helper: Find file by name and parent folder
  async findFile(fileName, parentId) {
    try {
      const response = await this.drive.files.list({
        q: `name='${fileName}' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id, name, size, modifiedTime, md5Checksum)'
      });
      
      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      console.error('Find file failed:', error);
      return null;
    }
  }

  // Helper: Ensure folder path exists
  async ensureFolderPath(folderPath) {
    if (!folderPath || folderPath === '.' || folderPath === '/') {
      return { id: this.rootFolderId };
    }
    
    const parts = folderPath.split('/').filter(part => part.length > 0);
    let currentFolder = { id: this.rootFolderId };
    
    for (const part of parts) {
      const existingFolder = await this.findFile(part, currentFolder.id);
      
      if (existingFolder) {
        currentFolder = existingFolder;
      } else {
        // Create new folder
        const folderMetadata = {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentFolder.id]
        };
        
        const result = await this.drive.files.create({
          resource: folderMetadata,
          fields: 'id, name'
        });
        
        currentFolder = result.data;
      }
    }
    
    return currentFolder;
  }

  // Helper: Find folder by path
  async findFolderByPath(folderPath) {
    if (!folderPath || folderPath === '.' || folderPath === '/') {
      return { id: this.rootFolderId };
    }
    
    const parts = folderPath.split('/').filter(part => part.length > 0);
    let currentFolder = { id: this.rootFolderId };
    
    for (const part of parts) {
      const folder = await this.findFile(part, currentFolder.id);
      if (!folder) {
        return null;
      }
      currentFolder = folder;
    }
    
    return currentFolder;
  }

  // Helper: Get file path by ID
  async getFilePath(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'name, parents'
      });
      
      const file = response.data;
      const pathParts = [file.name];
      
      // Build path by traversing parents
      let currentParents = file.parents;
      while (currentParents && currentParents.length > 0 && currentParents[0] !== this.rootFolderId) {
        const parentResponse = await this.drive.files.get({
          fileId: currentParents[0],
          fields: 'name, parents'
        });
        
        const parent = parentResponse.data;
        pathParts.unshift(parent.name);
        currentParents = parent.parents;
      }
      
      return pathParts.join('/');
    } catch (error) {
      console.error('Get file path failed:', error);
      return fileId; // Fallback to file ID
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.drive.about.get({
        fields: 'user, storageQuota'
      });
      
      return {
        connected: true,
        user: response.data.user.displayName,
        email: response.data.user.emailAddress,
        quota: response.data.storageQuota
      };
    } catch (error) {
      console.error('Google Drive connection test failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = GoogleDriveProvider;
