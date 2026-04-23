import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface EmailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendEmail = async ({ email, subject, message }: EmailOptions): Promise<boolean> => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'indhumathi.img@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Indhumathi Garments';

  if (!apiKey) {
    console.warn('⚠️ Brevo API Key missing. Email fallback to console.');
    console.log(`📧 TO: ${email}`);
    console.log(`📝 SUB: ${subject}`);
    console.log(`💬 MSG: ${message}`);
    return true;
  }

  try {
    let htmlContent = '';
    
    // Check if this is an OTP / Verification email based on subject
    if (subject.toLowerCase().includes('verification') || subject.toLowerCase().includes('otp')) {
      htmlContent = `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #db2777;">Indhumathi Garments</h2>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing: 5px; background: #f3f4f6; padding: 10px; display: inline-block; border-radius: 5px;">${message.replace(/[^0-9]/g, '')}</h1>
          <p style="font-size: 12px; color: #666;">Valid for 10 minutes.</p>
        </div>`;
    } else {
      // Professional Generic / Order Confirmation template
      htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #db2777; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Indhumathi Garments</h1>
          </div>
          <div style="padding: 30px 20px; color: #374151; line-height: 1.6; font-size: 16px;">
            <p>${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280; margin: 0;">&copy; ${new Date().getFullYear()} Indhumathi Garments. All rights reserved.</p>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0 0 0;">Premium Cotton Women's Lingerie | Pure Comfort & Quality</p>
          </div>
        </div>`;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: email, name: email.split('@')[0] }],
        subject: subject,
        htmlContent: htmlContent,
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Brevo API error:', errorData);
      return false;
    }

    console.log(`✅ Email sent to ${email} via Brevo`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send email via Brevo:', error.message);
    return false;
  }
};


export default sendEmail;
