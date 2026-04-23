import dotenv from 'dotenv';

dotenv.config();

// Interface for SMS options
interface SMSOptions {
  phone: string;
  message: string;
}

const sendSMS = async ({ phone, message }: SMSOptions): Promise<boolean> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  // 1. Fallback to Console (Development)
  if (!accountSid || !authToken || !fromNumber) {
    console.warn('⚠️ Twilio credentials missing. SMS fallback to console.');
    console.log(`📱 TO: ${phone}`);
    console.log(`💬 MSG: ${message}`);
    return true; // Pretend it worked
  }

  // 2. Real SMS via Twilio
  try {
    // Dynamic import to avoid crash if twilio is not installed yet
    const client = (await import('twilio')).default(accountSid, authToken);
    
    await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone,
    });
    
    console.log(`✅ SMS sent to ${phone}`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send SMS:', error.message);
    return false;
  }
};

export default sendSMS;
