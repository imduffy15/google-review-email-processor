const fs = require('fs');
const { simpleParser } = require('mailparser');
const prettier = require('prettier');
const cheerio = require('cheerio');

// Get the EML file path from command-line arguments
const emlFilePath = process.argv[2];

if (!emlFilePath) {
  console.error('Please provide the path to the EML file as a command-line argument.');
  console.error('Usage: node script.js <path_to_eml_file>');
  process.exit(1);
}

fs.readFile(emlFilePath, (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  simpleParser(data)
    .then((parsed) => {
      if (parsed.html) {
        // Use Cheerio to parse and clean the HTML
        const $ = cheerio.load(parsed.html, {
          xmlMode: false,
          decodeEntities: false,
          recognizeSelfClosing: true,
          lowerCaseAttributeNames: false,
          lowerCaseTags: false,
        });

        // Get the cleaned HTML
        const cleanedHtml = $.html();

        try {
          // Format the cleaned HTML using prettier
          const formattedHtml = prettier.format(cleanedHtml, {
            parser: 'html',
            htmlWhitespaceSensitivity: 'ignore',
          });
          console.log(formattedHtml);
        } catch (err) {
          console.error('Error formatting HTML:', err);
          // If formatting fails, fall back to cleaned but unformatted HTML
          console.log(cleanedHtml);
        }
      } else {
        console.log('No HTML content found in the email.');
      }
    })
    .catch((err) => {
      console.error('Error parsing email:', err);
    });
});
