const path = require('path');
const fs = require('fs');

// Test script to verify apps.json loading
console.log('Testing apps.json loading...');

// Simulate development environment
const devPath = path.join(__dirname, '../data/apps.json');
console.log('Dev path:', devPath);
console.log('Dev path exists:', fs.existsSync(devPath));

// Simulate production environment
const prodPath = path.join(path.dirname(process.execPath), 'data', 'apps.json');
console.log('Prod path:', prodPath);
console.log('Prod path exists:', fs.existsSync(prodPath));

// Test actual loading
if (fs.existsSync(devPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(devPath, 'utf8'));
    console.log(`Successfully loaded ${data.length} apps from dev path`);
    console.log('App IDs:', data.map(app => app.id));
  } catch (error) {
    console.error('Error loading from dev path:', error.message);
  }
}

// Test directory structure
console.log('\nDirectory structure:');
const currentDir = path.dirname(__dirname);
console.log('Current dir:', currentDir);
console.log('Contents:');
try {
  const contents = fs.readdirSync(currentDir);
  contents.forEach(item => {
    const itemPath = path.join(currentDir, item);
    const stats = fs.statSync(itemPath);
    console.log(`  ${item} ${stats.isDirectory() ? '(dir)' : '(file)'}`);
  });
} catch (error) {
  console.error('Error reading directory:', error.message);
}
