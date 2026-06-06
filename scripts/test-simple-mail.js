// scripts/test-simple-mail.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const nodemailer = require('nodemailer');

async function main() {
  console.log('1. Reading environment variables...');
  console.log('GMAIL_USER:', process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0);

  console.log('2. Creating Nodemailer transporter...');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    },
  });

  console.log('3. Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP Connection verified successfully!');
  } catch (err) {
    console.error('❌ SMTP Connection verification failed:', err);
    process.exit(1);
  }

  console.log('4. Sending simple test email...');
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Spiritual Sync Test'}" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: 'Test Email from Spiritual Sync Diagnostic Script',
    text: 'If you are reading this, Gmail SMTP sending works perfectly! 🙏',
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
    process.exit(0);
  } catch (err) {
    console.error('❌ Email sending failed:', err);
    process.exit(1);
  }
}

main();
