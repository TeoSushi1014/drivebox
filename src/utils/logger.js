const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.cwd(), 'logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxFiles = options.maxFiles || 5;
    this.logLevel = options.logLevel || 'info';
    
    this.initializeLogger();
  }

  async initializeLogger() {
    try {
      // Ensure log directory exists
      await fs.ensureDir(this.logDir);
      
      // Configure Winston logger
      this.logger = winston.createLogger({
        level: this.logLevel,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        transports: [
          // Error log file
          new winston.transports.File({
            filename: path.join(this.logDir, 'error.log'),
            level: 'error',
            maxsize: this.maxFileSize,
            maxFiles: this.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          }),
          
          // Combined log file
          new winston.transports.File({
            filename: path.join(this.logDir, 'combined.log'),
            maxsize: this.maxFileSize,
            maxFiles: this.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          }),
          
          // Sync operations log
          new winston.transports.File({
            filename: path.join(this.logDir, 'sync.log'),
            level: 'info',
            maxsize: this.maxFileSize,
            maxFiles: this.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          }),
          
          // Security events log
          new winston.transports.File({
            filename: path.join(this.logDir, 'security.log'),
            level: 'warn',
            maxsize: this.maxFileSize,
            maxFiles: this.maxFiles,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            )
          })
        ]
      });
      
      // Add console transport for development
      if (process.env.NODE_ENV !== 'production') {
        this.logger.add(new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          )
        }));
      }
      

    } catch (error) {
      console.error('Failed to initialize logger:', error);
    }
  }

  // Log info message
  info(message, meta = {}) {
    this.logger.info(message, { category: 'general', ...meta });
  }

  // Log error message
  error(message, error = null, meta = {}) {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : {};
    
    this.logger.error(message, { 
      category: 'error', 
      ...errorMeta, 
      ...meta 
    });
  }

  // Log warning message
  warn(message, meta = {}) {
    this.logger.warn(message, { category: 'warning', ...meta });
  }

  // Log debug message
  debug(message, meta = {}) {
    this.logger.debug(message, { category: 'debug', ...meta });
  }

  // Log sync operation
  sync(operation, status, meta = {}) {
    this.logger.info(`Sync ${operation}: ${status}`, {
      category: 'sync',
      operation,
      status,
      ...meta
    });
  }

  // Log security event
  security(event, level = 'warn', meta = {}) {
    this.logger.log(level, `Security event: ${event}`, {
      category: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }

  // Log authentication event
  auth(event, username, success = true, meta = {}) {
    const level = success ? 'info' : 'warn';
    this.logger.log(level, `Auth ${event}: ${username} - ${success ? 'Success' : 'Failed'}`, {
      category: 'auth',
      event,
      username,
      success,
      ...meta
    });
  }

  // Log file operation
  file(operation, filePath, status = 'success', meta = {}) {
    this.logger.info(`File ${operation}: ${filePath} - ${status}`, {
      category: 'file',
      operation,
      filePath,
      status,
      ...meta
    });
  }

  // Log network operation
  network(operation, endpoint, status, meta = {}) {
    this.logger.info(`Network ${operation}: ${endpoint} - ${status}`, {
      category: 'network',
      operation,
      endpoint,
      status,
      ...meta
    });
  }

  // Log performance metrics
  performance(operation, duration, meta = {}) {
    this.logger.info(`Performance: ${operation} completed in ${duration}ms`, {
      category: 'performance',
      operation,
      duration,
      ...meta
    });
  }

  // Get log files information
  async getLogFiles() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = [];
      
      for (const file of files) {
        if (path.extname(file) === '.log') {
          const filePath = path.join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime
          });
        }
      }
      
      return logFiles.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      this.error('Failed to get log files', error);
      return [];
    }
  }

  // Read log file content
  async readLogFile(fileName, lines = 100) {
    try {
      const filePath = path.join(this.logDir, fileName);
      
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Log file not found: ${fileName}`);
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      const logLines = content.split('\n')
        .filter(line => line.trim())
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: null, level: 'unknown' };
          }
        });
      
      return logLines;
    } catch (error) {
      this.error('Failed to read log file', error, { fileName });
      throw error;
    }
  }

  // Search logs
  async searchLogs(query, options = {}) {
    try {
      const {
        logFile = 'combined.log',
        maxResults = 100,
        level = null,
        category = null,
        startDate = null,
        endDate = null
      } = options;
      
      const logs = await this.readLogFile(logFile, 1000);
      
      let filteredLogs = logs.filter(log => {
        // Text search
        const matchesQuery = !query || 
          log.message.toLowerCase().includes(query.toLowerCase()) ||
          JSON.stringify(log).toLowerCase().includes(query.toLowerCase());
        
        // Level filter
        const matchesLevel = !level || log.level === level;
        
        // Category filter
        const matchesCategory = !category || log.category === category;
        
        // Date range filter
        const logDate = new Date(log.timestamp);
        const afterStart = !startDate || logDate >= new Date(startDate);
        const beforeEnd = !endDate || logDate <= new Date(endDate);
        
        return matchesQuery && matchesLevel && matchesCategory && afterStart && beforeEnd;
      });
      
      return filteredLogs.slice(-maxResults);
    } catch (error) {
      this.error('Failed to search logs', error, { query, options });
      throw error;
    }
  }

  // Export logs
  async exportLogs(outputPath, options = {}) {
    try {
      const {
        format = 'json',
        startDate = null,
        endDate = null,
        level = null
      } = options;
      
      const logFiles = await this.getLogFiles();
      const allLogs = [];
      
      for (const file of logFiles) {
        const logs = await this.readLogFile(file.name, -1); // Read all
        allLogs.push(...logs);
      }
      
      // Filter logs
      let filteredLogs = allLogs;
      
      if (startDate || endDate || level) {
        filteredLogs = allLogs.filter(log => {
          const logDate = new Date(log.timestamp);
          const afterStart = !startDate || logDate >= new Date(startDate);
          const beforeEnd = !endDate || logDate <= new Date(endDate);
          const matchesLevel = !level || log.level === level;
          
          return afterStart && beforeEnd && matchesLevel;
        });
      }
      
      // Sort by timestamp
      filteredLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Export in requested format
      let content;
      if (format === 'csv') {
        const headers = 'timestamp,level,message,category\n';
        const rows = filteredLogs.map(log => 
          `"${log.timestamp}","${log.level}","${log.message.replace(/"/g, '""')}","${log.category || ''}"`
        ).join('\n');
        content = headers + rows;
      } else {
        content = JSON.stringify(filteredLogs, null, 2);
      }
      
      await fs.writeFile(outputPath, content, 'utf8');
      
      this.info('Logs exported successfully', { 
        outputPath, 
        format, 
        recordCount: filteredLogs.length 
      });
      
      return {
        success: true,
        path: outputPath,
        recordCount: filteredLogs.length
      };
    } catch (error) {
      this.error('Failed to export logs', error, { outputPath, options });
      throw error;
    }
  }

  // Clean old log files
  async cleanOldLogs(maxAge = 30) { // days
    try {
      const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
      const logFiles = await this.getLogFiles();
      let deletedCount = 0;
      
      for (const file of logFiles) {
        if (file.modified < cutoffDate) {
          await fs.remove(file.path);
          deletedCount++;
          this.info('Old log file deleted', { fileName: file.name, age: maxAge });
        }
      }
      
      return { deletedCount };
    } catch (error) {
      this.error('Failed to clean old logs', error);
      throw error;
    }
  }

  // Get log statistics
  async getLogStats() {
    try {
      const logFiles = await this.getLogFiles();
      const recentLogs = await this.readLogFile('combined.log', 1000);
      
      const stats = {
        totalFiles: logFiles.length,
        totalSize: logFiles.reduce((sum, file) => sum + file.size, 0),
        recentEntries: recentLogs.length,
        levelCounts: {},
        categoryCounts: {}
      };
      
      // Count by level and category
      recentLogs.forEach(log => {
        stats.levelCounts[log.level] = (stats.levelCounts[log.level] || 0) + 1;
        if (log.category) {
          stats.categoryCounts[log.category] = (stats.categoryCounts[log.category] || 0) + 1;
        }
      });
      
      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', error);
      return null;
    }
  }

  // Set log level
  setLogLevel(level) {
    this.logLevel = level;
    this.logger.level = level;
    this.info('Log level changed', { newLevel: level });
  }

  // Close logger
  close() {
    if (this.logger) {
      this.logger.close();
    }
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
