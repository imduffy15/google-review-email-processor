const fs = require('fs');
const path = require('path');

function loadFileContent(fileName) {
  try {
    // Construct the full path to the file
    const filePath = path.join(__dirname, fileName);
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

const validReviewEmail = loadFileContent('./valid-email.eml');
const invalidSenderEmail = loadFileContent('./invalid-email.eml');
const forwardedEmail = loadFileContent('./forwarded-email.eml');

module.exports = {
  validReviewEmail,
  invalidSenderEmail,
  forwardedEmail,
};
