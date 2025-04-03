const nodemailer = require('nodemailer');

// Configureer de e-mailtransporter (voorbeeld met Gmail)
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetToken) => {
  // Wijs naar de frontend-URL in plaats van de backend
  const resetUrl = `http://your-app-domain/resetPassword/${resetToken}`; // Pas aan naar je app-URL, bijv. een deep link
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Wachtwoordherstel voor QuickDrop',
    text: `Je hebt een verzoek ingediend om je wachtwoord te herstellen. Klik op de volgende link om je wachtwoord te resetten: ${resetUrl}\n\nAls je dit verzoek niet hebt ingediend, negeer deze e-mail. Deze link verloopt over 1 uur.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Wachtwoordherstel-e-mail verzonden naar ${email}`);
  } catch (error) {
    console.error('Fout bij het verzenden van e-mail:', error);
    throw new Error('Kon de e-mail niet verzenden');
  }
};

module.exports = { sendPasswordResetEmail };