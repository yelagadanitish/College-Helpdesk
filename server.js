


const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const { stringify } = require('csv-stringify');

const app = express();
const port = 3000;
const csvFilePath = path.join(__dirname, 'users.csv');

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));
app.use(express.static('public'));

// CSV headers
const headers = [
  'User ID',
  'Full Name',
  'Email',
  'Role',
  'Department',
  'Year',
  'Date Created',
  'Is Active',
  'Last Login'
];

// Initialize CSV file if it doesn't exist
async function initializeCsvFile() {
  try {
    await fs.access(csvFilePath);
  } catch (error) {
    console.log('Creating new users.csv file');
    const csvData = await new Promise((resolve, reject) => {
      stringify([headers], { quoted: true }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    await fs.writeFile(csvFilePath, csvData);
  }
}

// Check for duplicate User ID or email
async function checkDuplicates(id, email) {
  try {
    const csvContent = await fs.readFile(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').slice(1); // Skip header
    for (const line of lines) {
      if (line) {
        const fields = line.split(',').map(field => field.replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (fields[0] === id) {
          return 'User ID already exists';
        }
        if (fields[2] && fields[2].toLowerCase() === email.toLowerCase()) {
          return 'Email already exists';
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return 'Error checking duplicates';
  }
}

// API to create a new user and append to CSV
app.post('/api/users', async (req, res) => {
  console.log('Received POST /api/users:', req.body);
  try {
    const { id, name, email, role, department, year, dateCreated, isActive, lastLogin } = req.body;

    // Validation
    if (!id || !name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: 'User ID must contain only numbers' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check duplicates
    const duplicateError = await checkDuplicates(id, email);
    if (duplicateError) {
      return res.status(400).json({ error: duplicateError });
    }

    // Prepare CSV row
    const row = [
      id,
      name,
      email,
      role,
      department || 'N/A',
      year || 'N/A',
      dateCreated ? new Date(dateCreated).toLocaleString() : new Date().toLocaleString(),
      isActive ? 'Yes' : 'No',
      lastLogin ? new Date(lastLogin).toLocaleString() : 'N/A'
    ];

    // Append to CSV
    const csvData = await new Promise((resolve, reject) => {
      stringify([row], { quoted: true }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });
    await fs.appendFile(csvFilePath, csvData);
    console.log(`Appended user ${id} to users.csv`);

    // Log activity (in-memory for simplicity)
    const activityLog = [];
    const logMessage = role === 'student'
      ? `Created new ${role} account for ${name} with ID ${id} (Year ${year || 'N/A'})`
      : `Created new ${role} account for ${name} with ID ${id}`;
    activityLog.push({ action: logMessage, timestamp: new Date().toISOString() });
    console.log('ActivityLog:', logMessage);

    res.json({ message: 'User created successfully and appended to CSV' });
  } catch (error) {
    console.error('Error in /api/users:', error.stack);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// API to download the CSV file
app.get('/api/users/download', async (req, res) => {
  console.log('Received GET /api/users/download');
  try {
    await fs.access(csvFilePath);
    res.download(csvFilePath, 'users.csv', (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ error: 'Error downloading file' });
      }
    });
  } catch (error) {
    console.error('Error accessing CSV file:', error);
    res.status(404).json({ error: 'No user data available' });
  }
});

// Initialize CSV file and start server
initializeCsvFile().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to initialize server:', error);
  process.exit(1);
});