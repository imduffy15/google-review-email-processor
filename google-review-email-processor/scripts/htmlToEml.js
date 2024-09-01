const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

function compressHTML(html) {
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

async function generateEML(to, from, subject, htmlBody) {
  const compressedHTML = compressHTML(htmlBody);
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
  });

  const mailOptions = {
    from,
    to,
    subject,
    html: compressedHTML,
  };

  const info = await transporter.sendMail(mailOptions);

  return new Promise((resolve, reject) => {
    let emlContent = '';
    info.message.on('data', (chunk) => {
      emlContent += chunk;
    });
    info.message.on('end', () => resolve(emlContent));
    info.message.on('error', reject);
  });
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

async function main() {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 5) {
      throw new Error(
        'Usage: node script.js <to> <from> <subject> <html_file_path> <output_file_path>'
      );
    }

    const [to, from, subject, htmlFilePath, outputFilePath] = args;

    if (!validateEmail(to) || !validateEmail(from)) {
      throw new Error('Invalid email address provided');
    }

    if (!subject.trim()) {
      throw new Error('Subject cannot be empty');
    }

    const htmlBody = await fs.readFile(htmlFilePath, 'utf8');
    const emlContent = await generateEML(to, from, subject, htmlBody);

    const absoluteOutputPath = path.resolve(outputFilePath);
    await fs.writeFile(absoluteOutputPath, emlContent);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
