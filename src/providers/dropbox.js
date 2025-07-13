const { Dropbox } = require('dropbox');
const fs = require('fs-extra');
const path = require('path');
const SecurityManager = require('../utils/security');

class DropboxProvider {
  constructor(credentials) {
    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    
    this.dbx = new Dropbox({
      accessToken: this.accessToken,
      clientId: this.clientId,
      clientSecret: this.clientSecret
    });
    
    this.security = new SecurityManager();
    this.cursor = null; // For delta sync
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await this.dbx.authTokenRevoke();
      // Note: Dropbox API v2 doesn't use refresh tokens the same way
      // This is a placeholder for token refresh logic
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Get authorization URL
  static getAuthUrl(clientId, redirectUri) {
    const dbx = new Dropbox({ clientId });
    return dbx.getAuthenticationUrl(redirectUri);
  }

  // Authenticate with authorization code
  async authenticate(authCode, redirectUri) {
    try {
      const dbx = new Dropbox({
        clientId: this.clientId,
        clientSecret: this.clientSecret
      });
      
      const response = await dbx.getAccessTokenFromCode(redirectUri, authCode);
      this.accessToken = response.access_token;
      
      // Update the main Dropbox instance
      this.dbx = new Dropbox({
        accessToken: this.accessToken,
        clientId: this.clientId,
        clientSecret: this.clientSecret
      });
      
      return {
        accessToken: this.accessToken,
        tokenType: response.token_type,
        accountId: response.account_id
      };
    } catch (error) {
      console.error('Dropbox authentication failed:', error);
      throw error;
    }
  }

  // Upload file to Dropbox
  async uploadFile(localPath, remotePath) {
    try {
      // Ensure remote path starts with /
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }
      
      const fileContent = await fs.readFile(localPath);
      const fileSize = fileContent.length;
      
      let result;
      
      if (fileSize < 150 * 1024 * 1024) { // Less than 150MB
        // Simple upload
        result = await this.dbx.filesUpload({
          path: remotePath,
          contents: fileContent,
          mode: 'overwrite',
          autorename: false
        });
      } else {
        // Upload session for large files
        result = await this.uploadLargeFile(fileContent, remotePath);
      }
      
      return result;
    } catch (error) {
      console.error('Dropbox upload failed:', error);
      throw error;
    }
  }

  // Upload large file using sessions
  async uploadLargeFile(fileContent, remotePath) {
    try {
      const chunkSize = 8 * 1024 * 1024; // 8MB chunks
      let offset = 0;
      let sessionId = null;
      
      while (offset < fileContent.length) {
        const chunk = fileContent.slice(offset, offset + chunkSize);
        
        if (offset === 0) {
          // Start session
          const response = await this.dbx.filesUploadSessionStart({
            contents: chunk
          });
          sessionId = response.session_id;
        } else if (offset + chunk.length >= fileContent.length) {
          // Finish session
          const result = await this.dbx.filesUploadSessionFinish({
            cursor: {
              session_id: sessionId,
              offset: offset
            },
            commit: {
              path: remotePath,
              mode: 'overwrite',
              autorename: false
            },
            contents: chunk
          });
          return result;
        } else {
          // Append to session
          await this.dbx.filesUploadSessionAppendV2({
            cursor: {
              session_id: sessionId,
              offset: offset
            },
            contents: chunk
          });
        }
        
        offset += chunk.length;
      }
    } catch (error) {
      console.error('Large file upload failed:', error);
      throw error;
    }
  }

  // Download file from Dropbox
  async downloadFile(remotePath, localPath) {
    try {
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }
      
      const response = await this.dbx.filesDownload({
        path: remotePath
      });
      
      await fs.ensureDir(path.dirname(localPath));
      await fs.writeFile(localPath, response.fileBinary);
      
      return response.metadata;
    } catch (error) {
      console.error('Dropbox download failed:', error);
      throw error;
    }
  }

  // Delete file from Dropbox
  async deleteFile(remotePath) {
    try {
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }
      
      const result = await this.dbx.filesDeleteV2({
        path: remotePath
      });
      
      return result;
    } catch (error) {
      // Ignore file not found errors
      if (error.status === 409) {
        return;
      }
      console.error('Dropbox delete failed:', error);
      throw error;
    }
  }

  // Create folder
  async createFolder(folderPath) {
    try {
      if (!folderPath.startsWith('/')) {
        folderPath = '/' + folderPath;
      }
      
      const result = await this.dbx.filesCreateFolderV2({
        path: folderPath,
        autorename: false
      });
      
      return result;
    } catch (error) {
      // Ignore folder already exists errors
      if (error.status === 409) {
        return;
      }
      console.error('Dropbox folder creation failed:', error);
      throw error;
    }
  }

  // Delete folder
  async deleteFolder(folderPath) {
    try {
      if (!folderPath.startsWith('/')) {
        folderPath = '/' + folderPath;
      }
      
      const result = await this.dbx.filesDeleteV2({
        path: folderPath
      });
      
      return result;
    } catch (error) {
      // Ignore folder not found errors
      if (error.status === 409) {
        return;
      }
      console.error('Dropbox folder deletion failed:', error);
      throw error;
    }
  }

  // List all files
  async listFiles(folderPath = '') {
    try {
      const files = [];
      let hasMore = true;
      let cursor = null;
      
      while (hasMore) {
        let response;
        
        if (cursor) {
          response = await this.dbx.filesListFolderContinue({
            cursor: cursor
          });
        } else {
          response = await this.dbx.filesListFolder({
            path: folderPath,
            recursive: true,
            include_media_info: false,
            include_deleted: false,
            include_has_explicit_shared_members: false
          });
        }
        
        for (const entry of response.entries) {
          if (entry['.tag'] === 'file') {
            files.push({
              id: entry.id,
              path: entry.path_lower.substring(1), // Remove leading /
              name: entry.name,
              size: entry.size,
              modified: new Date(entry.server_modified).getTime(),
              hash: entry.content_hash,
              rev: entry.rev
            });
          }
        }
        
        hasMore = response.has_more;
        cursor = response.cursor;
      }
      
      return files;
    } catch (error) {
      console.error('Dropbox list files failed:', error);
      throw error;
    }
  }

  // Get changes since last sync
  async getChanges() {
    try {
      const changes = [];
      
      if (!this.cursor) {
        // Get initial cursor
        const response = await this.dbx.filesListFolderGetLatestCursor({
          path: '',
          recursive: true,
          include_media_info: false,
          include_deleted: true,
          include_has_explicit_shared_members: false
        });
        this.cursor = response.cursor;
        return changes; // No changes on first run
      }
      
      let hasMore = true;
      let currentCursor = this.cursor;
      
      while (hasMore) {
        const response = await this.dbx.filesListFolderContinue({
          cursor: currentCursor
        });
        
        for (const entry of response.entries) {
          if (entry['.tag'] === 'file') {
            changes.push({
              event: 'change',
              path: entry.path_lower.substring(1), // Remove leading /
              name: entry.name,
              size: entry.size,
              modified: new Date(entry.server_modified).getTime(),
              hash: entry.content_hash,
              rev: entry.rev
            });
          } else if (entry['.tag'] === 'deleted') {
            changes.push({
              event: 'delete',
              path: entry.path_lower.substring(1), // Remove leading /
              name: entry.name
            });
          }
        }
        
        hasMore = response.has_more;
        currentCursor = response.cursor;
      }
      
      // Update cursor for next sync
      this.cursor = currentCursor;
      return changes;
    } catch (error) {
      console.error('Dropbox get changes failed:', error);
      throw error;
    }
  }

  // Get file metadata
  async getFileMetadata(remotePath) {
    try {
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }
      
      const response = await this.dbx.filesGetMetadata({
        path: remotePath,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false
      });
      
      return {
        id: response.id,
        path: response.path_lower.substring(1),
        name: response.name,
        size: response.size,
        modified: new Date(response.server_modified).getTime(),
        hash: response.content_hash,
        rev: response.rev
      };
    } catch (error) {
      if (error.status === 409) {
        return null; // File not found
      }
      console.error('Get file metadata failed:', error);
      throw error;
    }
  }

  // Search files
  async searchFiles(query, maxResults = 100) {
    try {
      const response = await this.dbx.filesSearchV2({
        query: query,
        options: {
          path: '',
          max_results: maxResults,
          order_by: 'relevance',
          file_status: 'active',
          filename_only: false
        }
      });
      
      const files = [];
      for (const match of response.matches) {
        if (match.metadata.metadata['.tag'] === 'file') {
          const file = match.metadata.metadata;
          files.push({
            id: file.id,
            path: file.path_lower.substring(1),
            name: file.name,
            size: file.size,
            modified: new Date(file.server_modified).getTime(),
            hash: file.content_hash,
            rev: file.rev
          });
        }
      }
      
      return files;
    } catch (error) {
      console.error('Dropbox search failed:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection() {
    try {
      const response = await this.dbx.usersGetCurrentAccount();
      
      return {
        connected: true,
        user: response.name.display_name,
        email: response.email,
        accountId: response.account_id,
        accountType: response.account_type['.tag']
      };
    } catch (error) {
      console.error('Dropbox connection test failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // Get account space usage
  async getSpaceUsage() {
    try {
      const response = await this.dbx.usersGetSpaceUsage();
      
      return {
        used: response.used,
        allocation: response.allocation
      };
    } catch (error) {
      console.error('Get space usage failed:', error);
      throw error;
    }
  }

  // Create shared link
  async createSharedLink(remotePath) {
    try {
      if (!remotePath.startsWith('/')) {
        remotePath = '/' + remotePath;
      }
      
      const response = await this.dbx.sharingCreateSharedLinkWithSettings({
        path: remotePath,
        settings: {
          requested_visibility: 'public',
          audience: 'public',
          access: 'viewer'
        }
      });
      
      return {
        url: response.url,
        id: response.id,
        name: response.name,
        expires: response.expires
      };
    } catch (error) {
      console.error('Create shared link failed:', error);
      throw error;
    }
  }
}

module.exports = DropboxProvider;
