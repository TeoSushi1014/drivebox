const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');

class SecurityManager {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.keyDerivationIterations = 100000;
    this.rsaKeySize = 2048;
  }

  // Generate SHA256 hash for file integrity
  generateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }  // Encrypt data using AES-256-CBC
  encryptData(data, password) {
    const salt = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, this.keyDerivationIterations, 32, 'sha256');
    
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  // Decrypt data using AES-256-CBC
  decryptData(encryptedData, password) {
    const { encrypted, salt, iv } = encryptedData;
    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 
                                  this.keyDerivationIterations, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, Buffer.from(iv, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Generate RSA key pair for secure communications
  generateRSAKeyPair() {
    const key = new NodeRSA({ b: this.rsaKeySize });
    return {
      publicKey: key.exportKey('public'),
      privateKey: key.exportKey('private')
    };
  }

  // Hash password with bcrypt
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password with bcrypt
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate secure random token
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Validate file integrity
  async validateFileIntegrity(filePath, expectedHash) {
    try {
      const actualHash = await this.generateFileHash(filePath);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('File integrity validation failed:', error);
      return false;
    }
  }

  // Encrypt file
  async encryptFile(inputPath, outputPath, password) {
    try {
      const data = await fs.readFile(inputPath, 'utf8');
      const encryptedData = this.encryptData(data, password);
      await fs.writeJSON(outputPath, encryptedData);
      return true;
    } catch (error) {
      console.error('File encryption failed:', error);
      return false;
    }
  }

  // Decrypt file
  async decryptFile(inputPath, outputPath, password) {
    try {
      const encryptedData = await fs.readJSON(inputPath);
      const decryptedData = this.decryptData(encryptedData, password);
      await fs.writeFile(outputPath, decryptedData, 'utf8');
      return true;
    } catch (error) {
      console.error('File decryption failed:', error);
      return false;
    }
  }
}

module.exports = SecurityManager;
