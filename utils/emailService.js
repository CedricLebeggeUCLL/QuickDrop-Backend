const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `quickdrop://resetPassword/${resetToken}`;
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Wachtwoordherstel voor QuickDrop',
    text: `Je hebt een verzoek ingediend om je wachtwoord te herstellen. Kopieer en plak de volgende link om je wachtwoord te resetten: ${resetUrl}\n\nAls je dit verzoek niet hebt ingediend, negeer deze e-mail. Deze link verloopt over 1 uur.`,
    html: `
      <p>Je hebt een verzoek ingediend om je wachtwoord te herstellen.</p>
      <p>Kopieer en plak de onderstaande link om je wachtwoord te resetten:</p>
      <p><a href="${resetUrl}" style="color: #28a745; text-decoration: underline;">${resetUrl}</a></p>
      <p>Als de link niet klikbaar is, kopieer en plak deze handmatig in je browser of app.</p>
      <p>Als je dit verzoek niet hebt ingediend, negeer deze e-mail.</p>
      <p>Deze link verloopt over 1 uur.</p>
    `,
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