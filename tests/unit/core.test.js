const { describe, it, before, after, beforeEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const SecurityManager = require('../../src/utils/security');
const SyncEngine = require('../../src/utils/syncEngine');
const AuthenticationManager = require('../../src/auth/authManager');

describe('Security Manager Tests', () => {
  let security;
  let testDir;

  before(async () => {
    security = new SecurityManager();
    testDir = path.join(__dirname, '../temp/security');
    await fs.ensureDir(testDir);
  });

  after(async () => {
    await fs.remove(testDir);
  });

  describe('File Hashing', () => {
    it('should generate SHA256 hash for a file', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, World!');
      
      const hash = await security.generateFileHash(testFile);
      expect(hash).to.be.a('string');
      expect(hash.length).to.equal(64); // SHA256 hex length
    });

    it('should generate consistent hashes for same content', async () => {
      const testFile1 = path.join(testDir, 'test1.txt');
      const testFile2 = path.join(testDir, 'test2.txt');
      const content = 'Consistent content';
      
      await fs.writeFile(testFile1, content);
      await fs.writeFile(testFile2, content);
      
      const hash1 = await security.generateFileHash(testFile1);
      const hash2 = await security.generateFileHash(testFile2);
      
      expect(hash1).to.equal(hash2);
    });
  });

  describe('Data Encryption', () => {    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'Sensitive information';
      const password = 'test-password-123';
      
      const encrypted = security.encryptData(originalData, password);
      expect(encrypted).to.have.property('encrypted');
      expect(encrypted).to.have.property('salt');
      expect(encrypted).to.have.property('iv');
      
      const decrypted = security.decryptData(encrypted, password);
      expect(decrypted).to.equal(originalData);
    });

    it('should fail with wrong password', () => {
      const originalData = 'Sensitive information';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      
      const encrypted = security.encryptData(originalData, password);
      
      expect(() => {
        security.decryptData(encrypted, wrongPassword);
      }).to.throw();
    });
  });

  describe('Password Management', () => {
    it('should hash passwords securely', async () => {
      const password = 'test-password-123';
      const hash = await security.hashPassword(password);
      
      expect(hash).to.be.a('string');
      expect(hash).to.not.equal(password);
      expect(hash.length).to.be.greaterThan(50);
    });

    it('should verify passwords correctly', async () => {
      const password = 'test-password-123';
      const hash = await security.hashPassword(password);
      
      const isValid = await security.verifyPassword(password, hash);
      expect(isValid).to.be.true;
      
      const isInvalid = await security.verifyPassword('wrong-password', hash);
      expect(isInvalid).to.be.false;
    });
  });

  describe('File Encryption', () => {
    it('should encrypt and decrypt files', async () => {
      const inputFile = path.join(testDir, 'input.txt');
      const encryptedFile = path.join(testDir, 'encrypted.json');
      const decryptedFile = path.join(testDir, 'decrypted.txt');
      const password = 'file-password-123';
      const content = 'File content to encrypt';
      
      await fs.writeFile(inputFile, content);
      
      const encrypted = await security.encryptFile(inputFile, encryptedFile, password);
      expect(encrypted).to.be.true;
      expect(await fs.pathExists(encryptedFile)).to.be.true;
      
      const decrypted = await security.decryptFile(encryptedFile, decryptedFile, password);
      expect(decrypted).to.be.true;
      
      const decryptedContent = await fs.readFile(decryptedFile, 'utf8');
      expect(decryptedContent).to.equal(content);
    });
  });

  describe('Token Generation', () => {
    it('should generate secure random tokens', () => {
      const token1 = security.generateSecureToken();
      const token2 = security.generateSecureToken();
      
      expect(token1).to.be.a('string');
      expect(token2).to.be.a('string');
      expect(token1).to.not.equal(token2);
      expect(token1.length).to.equal(64); // 32 bytes * 2 (hex)
    });

    it('should generate tokens of specified length', () => {
      const length = 16;
      const token = security.generateSecureToken(length);
      
      expect(token.length).to.equal(length * 2); // hex encoding
    });
  });
});

describe('Authentication Manager Tests', () => {
  let authManager;
  
  beforeEach(() => {
    authManager = new AuthenticationManager();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        password: 'TestPass123!',
        email: 'test@example.com'
      };
      
      const result = await authManager.registerUser(userData);
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('userId');
      expect(result).to.have.property('apiKey');
    });

    it('should reject invalid usernames', async () => {
      const userData = {
        username: 'te', // too short
        password: 'TestPass123!',
        email: 'test@example.com'
      };
      
      try {
        await authManager.registerUser(userData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('username');
      }
    });    it('should reject weak passwords', async () => {
      const userData = {
        username: 'testuser',
        password: 'weak', // too weak
        email: 'test@example.com'
      };
      
      try {
        await authManager.registerUser(userData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message.toLowerCase()).to.include('password');
      }
    });

    it('should reject invalid emails', async () => {
      const userData = {
        username: 'testuser',
        password: 'TestPass123!',
        email: 'invalid-email'
      };
      
      try {
        await authManager.registerUser(userData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('email');
      }
    });
  });
  describe('User Authentication', () => {
    beforeEach(async () => {
      // Register a test user with unique name
      const timestamp = Date.now();
      await authManager.registerUser({
        username: `testuser${timestamp}`,
        password: 'TestPass123!',
        email: `test${timestamp}@example.com`
      });
      
      // Store the username for use in tests
      authManager._testUsername = `testuser${timestamp}`;
    });

    it('should authenticate valid credentials', async () => {
      const result = await authManager.authenticateUser(authManager._testUsername, 'TestPass123!');
      
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('sessionToken');
      expect(result).to.have.property('user');
    });

    it('should reject invalid credentials', async () => {
      try {
        await authManager.authenticateUser(authManager._testUsername, 'WrongPassword');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('credentials');
      }
    });
  });
  describe('Session Management', () => {
    let sessionToken;
    
    beforeEach(async () => {
      const timestamp = Date.now();
      const username = `testuser${timestamp}`;
      
      await authManager.registerUser({
        username: username,
        password: 'TestPass123!',
        email: `test${timestamp}@example.com`
      });
      
      const authResult = await authManager.authenticateUser(username, 'TestPass123!');
      sessionToken = authResult.sessionToken;
      authManager._testUsername = username;
    });

    it('should validate active sessions', () => {
      const session = authManager.validateSession(sessionToken);
      
      expect(session).to.not.be.null;
      expect(session).to.have.property('username', authManager._testUsername);
    });

    it('should reject invalid session tokens', () => {
      const session = authManager.validateSession('invalid-token');
      expect(session).to.be.null;
    });

    it('should logout users and invalidate sessions', () => {
      authManager.logout(sessionToken);
      
      const session = authManager.validateSession(sessionToken);
      expect(session).to.be.null;
    });
  });
});

describe('Sync Engine Tests', () => {
  let syncEngine;
  let testDir;
  let mockProvider;

  before(async () => {
    testDir = path.join(__dirname, '../temp/sync');
    await fs.ensureDir(testDir);
    
    // Create mock provider
    mockProvider = {
      uploadFile: async (localPath, remotePath) => {
        console.log(`Mock upload: ${localPath} -> ${remotePath}`);
        return { success: true };
      },
      downloadFile: async (remotePath, localPath) => {
        console.log(`Mock download: ${remotePath} -> ${localPath}`);
        return { success: true };
      },
      deleteFile: async (remotePath) => {
        console.log(`Mock delete: ${remotePath}`);
        return { success: true };
      },
      createFolder: async (folderPath) => {
        console.log(`Mock create folder: ${folderPath}`);
        return { success: true };
      },
      deleteFolder: async (folderPath) => {
        console.log(`Mock delete folder: ${folderPath}`);
        return { success: true };
      },
      listFiles: async () => {
        return [];
      },
      getChanges: async () => {
        return [];
      }
    };
  });

  after(async () => {
    if (syncEngine) {
      await syncEngine.stopSync();
    }
    await fs.remove(testDir);
  });

  beforeEach(async () => {
    syncEngine = new SyncEngine({
      localPath: testDir,
      syncInterval: 1000 // 1 second for testing
    });
  });

  describe('Provider Management', () => {
    it('should add providers successfully', () => {
      syncEngine.addProvider('test', mockProvider);
      
      const stats = syncEngine.getStats();
      expect(stats.providersCount).to.equal(1);
    });

    it('should remove providers successfully', () => {
      syncEngine.addProvider('test', mockProvider);
      syncEngine.removeProvider('test');
      
      const stats = syncEngine.getStats();
      expect(stats.providersCount).to.equal(0);
    });
  });

  describe('Local File Watching', () => {
    it('should detect file creation', (done) => {
      syncEngine.addProvider('test', mockProvider);
      
      syncEngine.on('localChange', (change) => {
        if (change.event === 'add' && change.path === 'test-file.txt') {
          expect(change).to.have.property('event', 'add');
          expect(change).to.have.property('path', 'test-file.txt');
          done();
        }
      });
      
      syncEngine.startWatching();
      
      // Create a test file
      setTimeout(async () => {
        await fs.writeFile(path.join(testDir, 'test-file.txt'), 'Test content');
      }, 100);
    }).timeout(5000);
  });

  describe('Sync Operations', () => {
    it('should start and stop sync engine', async () => {
      syncEngine.addProvider('test', mockProvider);
      
      await syncEngine.startSync();
      expect(syncEngine.isRunning).to.be.true;
      
      await syncEngine.stopSync();
      expect(syncEngine.isRunning).to.be.false;
    });

    it('should get sync statistics', () => {
      const stats = syncEngine.getStats();
      
      expect(stats).to.have.property('isRunning');
      expect(stats).to.have.property('queueLength');
      expect(stats).to.have.property('providersCount');
      expect(stats).to.have.property('watchersCount');
      expect(stats).to.have.property('filesTracked');
    });
  });
});

describe('Integration Tests', () => {
  let testDir;
  let syncEngine;
  let authManager;
  
  before(async () => {
    testDir = path.join(__dirname, '../temp/integration');
    await fs.ensureDir(testDir);
  });

  after(async () => {
    if (syncEngine) {
      await syncEngine.stopSync();
    }
    await fs.remove(testDir);
  });

  beforeEach(() => {
    syncEngine = new SyncEngine({ localPath: testDir });
    authManager = new AuthenticationManager();
  });

  it('should integrate authentication with sync engine', async () => {
    // Register and authenticate user
    await authManager.registerUser({
      username: 'integrationuser',
      password: 'TestPass123!',
      email: 'integration@example.com'
    });
    
    const authResult = await authManager.authenticateUser('integrationuser', 'TestPass123!');
    expect(authResult.success).to.be.true;
    
    // Start sync engine
    await syncEngine.startSync();
    expect(syncEngine.isRunning).to.be.true;
    
    // Stop sync engine
    await syncEngine.stopSync();
    expect(syncEngine.isRunning).to.be.false;
    
    // Logout user
    authManager.logout(authResult.sessionToken);
    const session = authManager.validateSession(authResult.sessionToken);
    expect(session).to.be.null;
  });
});

// Run tests with proper setup
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({
    timeout: 10000,
    reporter: 'spec'
  });
  
  mocha.addFile(__filename);
  mocha.run((failures) => {
    process.exit(failures ? 1 : 0);
  });
}
