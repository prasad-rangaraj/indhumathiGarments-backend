import { FastifyInstance } from 'fastify';
import { AppDataSource } from '../lib/db.js';
import { Enquiry } from '../entities/Enquiry.js';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export default async function enquiryRoutes(appInstance: FastifyInstance) {
  const app = appInstance.withTypeProvider<ZodTypeProvider>();

  // Create enquiry (from contact form)
  app.post('/', {
      schema: {
          body: z.object({
              name: z.string(),
              email: z.string().email(),
              phone: z.string().optional(),
              subject: z.string(),
              message: z.string()
          })
      }
  }, async (request, reply) => {
    try {
      const { name, email, phone, subject, message } = request.body as Record<string, string>;

      const enquiryRepo = AppDataSource.getRepository(Enquiry);
      const enquiry = enquiryRepo.create({
            name,
            email,
            phone: phone || undefined,
            subject,
            message,
            status: 'New',
      });
      await enquiryRepo.save(enquiry);

      // Send email notification to owner
      const apiKey = process.env.BREVO_API_KEY;
      if (apiKey) {
         try {
            await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                body: JSON.stringify({
                    sender: { name: process.env.BREVO_SENDER_NAME || 'Contact Form', email: process.env.BREVO_SENDER_EMAIL || 'indhumathi.img@gmail.com' },
                    to: [{ email: 'indhumathi.img@gmail.com', name: 'Indhumathi Garments' }],
                    replyTo: { email: email, name: name },
                    subject: `New Enquiry: ${subject}`,
                    textContent: `You have received a new enquiry from your website.\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\n\nMessage:\n${message}`,
                })
            });
         } catch(e) {
             console.error('Failed to send enquiry email:', e);
         }
      }

      return reply.status(201).send(enquiry);
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
