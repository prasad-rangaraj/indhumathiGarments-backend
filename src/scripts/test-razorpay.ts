import 'dotenv/config';
import Razorpay from 'razorpay';

const testRazorpay = async () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  console.log('Testing Razorpay with Key ID:', key_id);

  if (!key_id || !key_secret) {
    console.error('Keys missing in .env');
    return;
  }

  const razorpay = new Razorpay({
    key_id,
    key_secret,
  });

  try {
    const order = await razorpay.orders.create({
      amount: 100, // 1 INR in paise
      currency: 'INR',
      receipt: `test_${Date.now()}`,
    });

    console.log('✅ Success! Razorpay Order Created:');
    console.log(JSON.stringify(order, null, 2));
  } catch (error: any) {
    console.error('❌ Razorpay Error:');
    console.error(error.error?.description || error.message || error);
  }
};

testRazorpay();
