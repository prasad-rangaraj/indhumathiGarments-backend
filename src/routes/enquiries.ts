import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Create enquiry (from contact form)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
        status: 'New',
      },
    });

    res.status(201).json(enquiry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


