
import 'reflect-metadata';
import { AppDataSource } from './src/lib/db.js';
import { ReturnRequest } from './src/entities/ReturnRequest.js';
import { Order } from './src/entities/Order.js';
import { isS3Key } from './src/lib/s3.js';

async function run() {
  await AppDataSource.initialize();
  const returnRepo = AppDataSource.getRepository(ReturnRequest);
  
  // get any return request
  const returnReq = await returnRepo.findOne({ order: { createdAt: 'DESC' } });
  if (!returnReq) {
    console.log('No return requests found.');
    return;
  }
  
  console.log('Testing with return request:', returnReq.id);
  
  try {
    const status = 'Approved';
    const adminNotes = 'Testing';
    
    // logic
    if (['Approved', 'Rejected', 'Processed', 'Return Rejected', 'Refund Completed', 'Cancelled'].includes(status)) {
        if (returnReq.images && returnReq.images.length > 0) {
          console.log('Deleting images...');
          await Promise.all(
            returnReq.images.map(img => {
              if (isS3Key(img)) {
                console.log('Would delete S3 key:', img.substring(0, 50));
              }
            })
          );
          returnReq.images = [];
        }
    }
    
    returnReq.status = status;
    returnReq.adminNotes = adminNotes;
    await returnRepo.save(returnReq);
    
    const orderRepo = AppDataSource.getRepository(Order);
    const order = await orderRepo.findOne({ where: { orderId: returnReq.orderId } });
    if (order) {
      order.status = 'Return Picked Up';
      await orderRepo.save(order);
    }
    console.log('Success!');
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await AppDataSource.destroy();
  }
}
run();

