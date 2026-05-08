import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function testUpload() {
  try {
    console.log("Testing S3 upload...");
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: 'test-upload.txt',
      Body: 'Hello world',
      ContentType: 'text/plain',
    });
    
    await s3Client.send(command);
    console.log("SUCCESS: S3 upload worked!");
  } catch (error: any) {
    console.error("FAILED S3 UPLOAD:");
    console.error(error.message);
  }
}

testUpload();
