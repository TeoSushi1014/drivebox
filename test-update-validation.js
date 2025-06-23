// Quick test for update validation function
const fs = require('fs');
const path = require('path');

// Validation function for update files (copied from main.js)
async function validateUpdateFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Update file not found' };
    }
    
    const stats = fs.statSync(filePath);
    
    // Check file size (should be at least 10MB for DriveBox)
    if (stats.size < 10 * 1024 * 1024) {
      return { valid: false, error: 'Update file is too small, likely corrupted' };
    }
    
    // Check if it's actually an executable
    const buffer = fs.readFileSync(filePath, { start: 0, end: 2 });
    if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) { // MZ header
      return { valid: false, error: 'Update file is not a valid executable' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Validation failed: ${error.message}` };
  }
}

// Test cases
async function runTests() {
  console.log('Testing update file validation...\n');
  
  // Test 1: Non-existent file
  console.log('Test 1: Non-existent file');
  const result1 = await validateUpdateFile('non-existent-file.exe');
  console.log('Result:', result1);
  console.log('Expected: File not found ✓\n');
  
  // Test 2: Small file (create a small test file)
  console.log('Test 2: Small file');
  const smallFile = path.join(__dirname, 'test-small.exe');
  fs.writeFileSync(smallFile, 'small file content');
  const result2 = await validateUpdateFile(smallFile);
  console.log('Result:', result2);
  console.log('Expected: Too small ✓');
  fs.unlinkSync(smallFile); // Cleanup
  console.log();
  
  // Test 3: Large but not executable file
  console.log('Test 3: Large non-executable file');
  const largeFile = path.join(__dirname, 'test-large.exe');
  const largeCont = Buffer.alloc(11 * 1024 * 1024, 'x'); // 11MB of 'x'
  fs.writeFileSync(largeFile, largeCont);
  const result3 = await validateUpdateFile(largeFile);
  console.log('Result:', result3);
  console.log('Expected: Not valid executable ✓');
  fs.unlinkSync(largeFile); // Cleanup
  console.log();
  
  console.log('All validation tests completed!');
}

runTests().catch(console.error);
