const fs = require('fs');
const path = require('path');

const DB_DIR = process.env.DB_DIR || path.join(__dirname, '../database');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function read(filename) {
  const fp = path.join(DB_DIR, filename);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

function write(filename, data) {
  const fp = path.join(DB_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { read, write, DB_DIR };
