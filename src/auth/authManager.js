const crypto = require('crypto');
const SecurityManager = require('../utils/security');
const Store = require('electron-store');

class AuthenticationManager {
  constructor() {
    this.security = new SecurityManager();
    this.store = new Store({ name: 'auth' });
    this.sessions = new Map();
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.failedAttempts = new Map();
    this.currentUser = null;
  }

  // Register new user
  async registerUser(userData) {
    try {
      const { username, password, email, twoFactorSecret } = userData;
      
      // Validate input
      if (!this.validateUsername(username)) {
        throw new Error('Invalid username format');
      }
      
      if (!this.validatePassword(password)) {
        throw new Error('Password does not meet security requirements');
      }
      
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email format');
      }
      
      // Check if user already exists
      const existingUsers = this.store.get('users', {});
      if (existingUsers[username]) {
        throw new Error('Username already exists');
      }
      
      // Hash password
      const hashedPassword = await this.security.hashPassword(password);
      
      // Generate user ID and keys
      const userId = this.security.generateSecureToken(16);
      const apiKey = this.security.generateSecureToken(32);
      const { publicKey, privateKey } = this.security.generateRSAKeyPair();
      
      // Encrypt private key with password
      const encryptedPrivateKey = this.security.encryptData(privateKey, password);
      
      // Store user data
      const user = {
        id: userId,
        username,
        email,
        passwordHash: hashedPassword,
        apiKey,
        publicKey,
        encryptedPrivateKey,
        twoFactorSecret: twoFactorSecret || null,
        twoFactorEnabled: !!twoFactorSecret,
        createdAt: Date.now(),
        lastLogin: null,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null
      };
      
      existingUsers[username] = user;
      this.store.set('users', existingUsers);
      
      console.log(`User registered: ${username}`);
      return {
        success: true,
        userId,
        apiKey
      };
    } catch (error) {
      console.error('User registration failed:', error);
      throw error;
    }
  }

  // Authenticate user
  async authenticateUser(username, password, twoFactorCode = null) {
    try {
      // Check for account lockout
      if (this.isAccountLocked(username)) {
        throw new Error('Account is temporarily locked due to too many failed attempts');
      }
      
      const users = this.store.get('users', {});
      const user = users[username];
      
      if (!user || !user.isActive) {
        this.recordFailedAttempt(username);
        throw new Error('Invalid credentials');
      }
      
      // Verify password
      const isValidPassword = await this.security.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        this.recordFailedAttempt(username);
        throw new Error('Invalid credentials');
      }
      
      // Verify 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          throw new Error('Two-factor authentication code required');
        }
        
        const isValid2FA = this.verify2FA(user.twoFactorSecret, twoFactorCode);
        if (!isValid2FA) {
          this.recordFailedAttempt(username);
          throw new Error('Invalid two-factor authentication code');
        }
      }
      
      // Clear failed attempts
      this.clearFailedAttempts(username);
      
      // Create session
      const sessionToken = this.createSession(user);
      
      // Update last login
      user.lastLogin = Date.now();
      users[username] = user;
      this.store.set('users', users);
      
      this.currentUser = user;
      
      console.log(`User authenticated: ${username}`);
      return {
        success: true,
        sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          apiKey: user.apiKey,
          twoFactorEnabled: user.twoFactorEnabled
        }
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  // Create user session
  createSession(user) {
    const sessionId = this.security.generateSecureToken(32);
    const expiresAt = Date.now() + this.sessionTimeout;
    
    const session = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      createdAt: Date.now(),
      expiresAt,
      lastActivity: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    
    // Clean up expired sessions
    this.cleanupExpiredSessions();
    
    return sessionId;
  }

  // Validate session
  validateSession(sessionToken) {
    const session = this.sessions.get(sessionToken);
    
    if (!session) {
      return null;
    }
    
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionToken);
      return null;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    this.sessions.set(sessionToken, session);
    
    return session;
  }

  // Logout user
  logout(sessionToken) {
    if (this.sessions.has(sessionToken)) {
      const session = this.sessions.get(sessionToken);
      this.sessions.delete(sessionToken);
      console.log(`User logged out: ${session.username}`);
    }
    
    this.currentUser = null;
  }

  // Change password
  async changePassword(username, currentPassword, newPassword) {
    try {
      const users = this.store.get('users', {});
      const user = users[username];
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isValidPassword = await this.security.verifyPassword(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
      
      // Validate new password
      if (!this.validatePassword(newPassword)) {
        throw new Error('New password does not meet security requirements');
      }
      
      // Hash new password
      const newHashedPassword = await this.security.hashPassword(newPassword);
      
      // Re-encrypt private key with new password
      const decryptedPrivateKey = this.security.decryptData(user.encryptedPrivateKey, currentPassword);
      const newEncryptedPrivateKey = this.security.encryptData(decryptedPrivateKey, newPassword);
      
      // Update user
      user.passwordHash = newHashedPassword;
      user.encryptedPrivateKey = newEncryptedPrivateKey;
      users[username] = user;
      this.store.set('users', users);
      
      console.log(`Password changed for user: ${username}`);
      return { success: true };
    } catch (error) {
      console.error('Password change failed:', error);
      throw error;
    }
  }

  // Enable/Disable 2FA
  async setup2FA(username, enable = true, secret = null) {
    try {
      const users = this.store.get('users', {});
      const user = users[username];
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (enable) {
        if (!secret) {
          secret = this.generate2FASecret();
        }
        user.twoFactorSecret = secret;
        user.twoFactorEnabled = true;
      } else {
        user.twoFactorSecret = null;
        user.twoFactorEnabled = false;
      }
      
      users[username] = user;
      this.store.set('users', users);
      
      console.log(`2FA ${enable ? 'enabled' : 'disabled'} for user: ${username}`);
      return {
        success: true,
        secret: enable ? secret : null
      };
    } catch (error) {
      console.error('2FA setup failed:', error);
      throw error;
    }
  }

  // Generate 2FA secret
  generate2FASecret() {
    return this.security.generateSecureToken(16);
  }

  // Verify 2FA code
  verify2FA(secret, code) {
    // Simple TOTP-like verification (in production, use proper TOTP library)
    const timeStep = Math.floor(Date.now() / 30000);
    const expectedCode = this.generateTOTP(secret, timeStep);
    return code === expectedCode;
  }

  // Generate TOTP code (simplified)
  generateTOTP(secret, timeStep) {
    const hash = crypto.createHmac('sha1', secret);
    hash.update(timeStep.toString());
    const hmac = hash.digest();
    const offset = hmac[19] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
  }

  // Validate username
  validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  // Validate password
  validatePassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  // Validate email
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Record failed login attempt
  recordFailedAttempt(username) {
    const attempts = this.failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    if (attempts.count >= this.maxFailedAttempts) {
      attempts.lockedUntil = Date.now() + this.lockoutDuration;
    }
    
    this.failedAttempts.set(username, attempts);
  }

  // Clear failed attempts
  clearFailedAttempts(username) {
    this.failedAttempts.delete(username);
  }

  // Check if account is locked
  isAccountLocked(username) {
    const attempts = this.failedAttempts.get(username);
    if (!attempts || !attempts.lockedUntil) {
      return false;
    }
    
    if (Date.now() > attempts.lockedUntil) {
      this.clearFailedAttempts(username);
      return false;
    }
    
    return true;
  }

  // Clean up expired sessions
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Get user by username
  getUser(username) {
    const users = this.store.get('users', {});
    return users[username] || null;
  }

  // Update user profile
  async updateUserProfile(username, updates) {
    try {
      const users = this.store.get('users', {});
      const user = users[username];
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Validate updates
      if (updates.email && !this.validateEmail(updates.email)) {
        throw new Error('Invalid email format');
      }
      
      // Apply updates
      if (updates.email) user.email = updates.email;
      
      users[username] = user;
      this.store.set('users', users);
      
      console.log(`User profile updated: ${username}`);
      return { success: true };
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }

  // Deactivate user
  deactivateUser(username) {
    const users = this.store.get('users', {});
    const user = users[username];
    
    if (user) {
      user.isActive = false;
      users[username] = user;
      this.store.set('users', users);
      
      // Invalidate all sessions for this user
      for (const [sessionId, session] of this.sessions) {
        if (session.username === username) {
          this.sessions.delete(sessionId);
        }
      }
      
      console.log(`User deactivated: ${username}`);
    }
  }

  // Get session statistics
  getSessionStats() {
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => Date.now() <= session.expiresAt);
    
    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      expiredSessions: this.sessions.size - activeSessions.length
    };
  }
}

module.exports = AuthenticationManager;
