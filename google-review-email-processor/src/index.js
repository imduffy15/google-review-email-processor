const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { simpleParser } = require('mailparser');
const cheerio = require('cheerio');

const s3Client = new S3Client();
const ALLOWED_SENDERS = ['businessprofile-noreply@google.com', 'ian@ianduffy.ie'];

const handler = async (event) => {
  try {
    const { bucket, object } = event.Records[0].s3;
    const command = new GetObjectCommand({
      Bucket: bucket.name,
      Key: object.key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      console.error('Response body is undefined');
      return createResponse(500, 'Response body is undefined');
    }
    const emailContent = await response.Body.transformToString();
    const parsedEmail = await simpleParser(emailContent);
    if (!isAllowedSender(parsedEmail.from.value[0].address)) {
      console.log(`Skipping email from non-allowed sender: ${parsedEmail.from.text}`);
      return createResponse(400, 'Email skipped - sender not allowed');
    }
    const htmlContent = parsedEmail.html?.replace(/[\s\u200D]+/g, ' ').trim();
    if (!htmlContent) {
      console.log('No HTML content found in the email');
      return createResponse(400, "Email skipped - body doesn't contain HTML");
    }
    const { reviewerName, reviewSnippet, rating } = extractReviewInfo(htmlContent);

    // Check if any of the extracted information is missing
    if (!reviewerName || !reviewSnippet || rating === 0) {
      console.error('Failed to extract complete review information');
      return createResponse(500, 'Failed to extract complete review information');
    }

    await processReview(reviewerName, reviewSnippet, rating);
    return createResponse(200, { reviewerName, reviewSnippet, rating });
  } catch (error) {
    console.error('Error processing email:', error);
    return createResponse(500, 'Error processing email');
  }
};

const isAllowedSender = (senderEmail) => ALLOWED_SENDERS.includes(senderEmail.toLowerCase());

const extractReviewInfo = (htmlContent) => {
  const $ = cheerio.load(htmlContent);
  $('template').remove();

  const paragraphs = $('[style*="border"]')
    .find('p[style*="font-size"], td[style*="font-size"]')
    .filter((_, el) => {
      return $(el).text().trim() !== '' && $(el).text().trim() !== 'Reply to review';
    });

  const reviewerName = paragraphs.first().text().trim();
  const starImageElement = $('[src*="-star-filled"]');
  const starRatingUrl = starImageElement.attr('src');
  const rating = starRatingUrl
    ? parseInt(starRatingUrl.match(/gmb-(\d)-star-filled/)?.[1] || '0')
    : 0;
  const reviewSnippet = paragraphs.last().text().trim();
  return { reviewerName, reviewSnippet, rating };
};

const processReview = async (reviewerName, reviewSnippet, rating) => {
  console.log(`Processed review from ${reviewerName}: ${reviewSnippet}, ${rating}`);
  // Implement actual processing logic here
};

const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
});

module.exports = {
  handler,
  isAllowedSender,
  extractReviewInfo,
  processReview,
  ALLOWED_SENDERS,
};
