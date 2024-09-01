const {
  validReviewEmail,
  invalidSenderEmail,
  forwardedEmail,
} = require('./fixtures/rawEmailFixtures.js');
const { handler, isAllowedSender, extractReviewInfo, ALLOWED_SENDERS } = require('../src/index.js');
const { simpleParser } = require('mailparser');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { mockClient } = require('aws-sdk-client-mock');
const { sdkStreamMixin } = require('@aws-sdk/util-stream-node');
const { Readable } = require('stream');

const s3Mock = mockClient(S3Client);

// describe('Lambda function real', () => {
//   test('should handle S3 real getObject and process valid email', async () => {
//     const event = {
//       Records: [
//         {
//           s3: {
//             bucket: { name: '893040360310-google-review-email-processor' },
//             object: { key: '1msjlp4o1bistiu4kmr9lp8peub3m7h0mtpe5n01' },
//           },
//         },
//       ],
//     };
//     const result = await handler(event);
//     expect(result).toEqual({
//       statusCode: 200,
//       body: JSON.stringify('Email processed successfully'),
//     });
//   });
// });

describe('Lambda function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle S3 getObject and process valid forwarded email', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from([await forwardedEmail])),
    });
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'test-key' },
          },
        },
      ],
    };
    const result = await handler(event);
    expect(s3Mock.call(0).args[0].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'test-key',
    });
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        reviewerName: 'Bob Hope',
        reviewSnippet: 'Really good place, would recommend.',
        rating: 5,
      }),
    });
  });

  test('should handle S3 getObject and process valid email', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from([await validReviewEmail])),
    });
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'test-key' },
          },
        },
      ],
    };
    const result = await handler(event);
    expect(s3Mock.call(0).args[0].input).toEqual({
      Bucket: 'test-bucket',
      Key: 'test-key',
    });
    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        reviewerName: 'Bob Hope',
        reviewSnippet: 'Really good place, would recommend.',
        rating: 5,
      }),
    });
  });

  test('should skip email from non-allowed sender', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from([await invalidSenderEmail])),
    });
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'test-key' },
          },
        },
      ],
    };
    const result = await handler(event);
    expect(result).toEqual({
      statusCode: 400,
      body: JSON.stringify('Email skipped - sender not allowed'),
    });
  });
});

describe('isAllowedSender', () => {
  test('should return true for allowed senders', async () => {
    expect(isAllowedSender(ALLOWED_SENDERS[0])).toBe(true);
  });

  test('should return false for non-allowed senders', async () => {
    expect(isAllowedSender('spam@example.org')).toBe(false);
  });
});

describe('extractReviewInfo', () => {
  test('should extract review information correctly', async () => {
    const parsedEmail = await simpleParser(await validReviewEmail);
    const result = extractReviewInfo(parsedEmail.html);
    expect(result).toEqual({
      reviewerName: 'Bob Hope',
      reviewSnippet: 'Really good place, would recommend.',
      rating: 5,
    });
  });
});
