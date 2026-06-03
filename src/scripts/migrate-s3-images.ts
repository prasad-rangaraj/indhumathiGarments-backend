import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { initDb, AppDataSource } from '../lib/db.js';
import { Product } from '../entities/Product.js';
import { s3, S3_BUCKET } from '../lib/s3.js';
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const sanitizeFolderName = (name: string) => {
  return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_/]/g, '').replace(/^\/+|\/+$/g, '');
};

const migrateKey = async (oldKey: string | undefined | null, productName: string): Promise<string | undefined | null> => {
  if (!oldKey) return oldKey;
  if (oldKey.startsWith('http') || oldKey.startsWith('/uploads/')) return oldKey;
  if (!oldKey.startsWith('products/')) return oldKey;

  const sanitizedName = sanitizeFolderName(productName);
  const targetPrefix = `products/${sanitizedName}/`;

  if (oldKey.startsWith(targetPrefix)) {
    // Already in the correct folder
    return oldKey;
  }

  // Extract the filename from the old key
  const parts = oldKey.split('/');
  const filename = parts[parts.length - 1];
  const newKey = `${targetPrefix}${filename}`;

  try {
    console.log(`Copying ${oldKey} -> ${newKey}`);
    await s3.send(new CopyObjectCommand({
      Bucket: S3_BUCKET,
      CopySource: encodeURI(`${S3_BUCKET}/${oldKey}`),
      Key: newKey,
    }));

    console.log(`Deleting ${oldKey}`);
    await s3.send(new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: oldKey,
    }));

    return newKey;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.message.includes('does not exist')) {
      // It's possible the file was already moved by a previous reference. Let's check if newKey exists.
      try {
        const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
        await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: newKey }));
        console.log(`File was already migrated, returning new key for ${oldKey}`);
        return newKey;
      } catch (headError) {
         console.error(`Failed to migrate ${oldKey} (not found at source or destination).`);
         return oldKey;
      }
    }
    console.error(`Failed to migrate ${oldKey}:`, error.message);
    return oldKey;
  }
};

const runMigration = async () => {
  try {
    await initDb();
    const productRepo = AppDataSource.getRepository(Product);
    const products = await productRepo.find();

    console.log(`Found ${products.length} products to check.`);

    for (const product of products) {
      console.log(`Processing product: ${product.name}`);
      let hasChanges = false;

      // Migrate primary image
      const newImage = await migrateKey(product.image, product.name);
      if (newImage !== product.image) {
        product.image = newImage as string;
        hasChanges = true;
      }

      // Migrate additional images
      if (product.images && product.images.length > 0) {
        const newImages = [];
        for (const img of product.images) {
          const newImg = await migrateKey(img, product.name);
          newImages.push(newImg as string);
          if (newImg !== img) hasChanges = true;
        }
        product.images = newImages;
      }

      // Migrate color images
      if (product.colors && product.colors.length > 0) {
        for (const color of product.colors) {
          if (color.images && color.images.length > 0) {
            const newColorImages = [];
            for (const img of color.images) {
              const newImg = await migrateKey(img, product.name);
              newColorImages.push(newImg as string);
              if (newImg !== img) hasChanges = true;
            }
            color.images = newColorImages;
          }

          if (color.primaryImage) {
            const newPrimary = await migrateKey(color.primaryImage, product.name);
            if (newPrimary !== color.primaryImage) {
              color.primaryImage = newPrimary as string;
              hasChanges = true;
            }
          }
        }
      }

      if (hasChanges) {
        await productRepo.save(product);
        console.log(`Saved changes for product: ${product.name}`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
