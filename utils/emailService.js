const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `http://192.168.4.64:8000/resetPassword.html?token=${resetToken}`; // Gebruik je lokale IP-adres
  const deepLinkUrl = `quickdrop://resetPassword/${resetToken}`; // Voor de fallback-instructie
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Wachtwoordherstel voor QuickDrop',
    text: `Je hebt een verzoek ingediend om je wachtwoord te herstellen. Klik op de volgende link om je wachtwoord te resetten: ${resetUrl}\n\nAls de link niet werkt, kopieer en plak deze in je browser: ${resetUrl}\n\nAlternatief, kopieer en plak deze deep link in je browser of app: ${deepLinkUrl}\n\nAls je dit verzoek niet hebt ingediend, negeer deze e-mail. Deze link verloopt over 1 uur.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #28a745; text-align: center;">Wachtwoordherstel voor QuickDrop</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">
          Je hebt een verzoek ingediend om je wachtwoord te herstellen. Klik op de onderstaande knop om je wachtwoord te resetten:
        </p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; color: #fff; background-color: #28a745; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">Wachtwoord Resetten</a>
        </div>
        <p style="color: #333; font-size: 14px; line-height: 1.5;">
          Als de knop niet werkt, kopieer en plak deze link in je browser: 
          <a href="${resetUrl}" style="color: #28a745; text-decoration: underline;">${resetUrl}</a>
        </p>
        <p style="color: #333; font-size: 14px; line-height: 1.5;">
          Alternatief, kopieer en plak deze deep link in je browser of app: 
          <a href="${deepLinkUrl}" style="color: #28a745; text-decoration: underline;">${deepLinkUrl}</a>
        </p>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          Als je dit verzoek niet hebt ingediend, negeer deze e-mail.
        </p>
        <p style="color: #666; font-size: 14px; line-height: 1.5;">
          Deze link verloopt over 1 uur.
        </p>
        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          &copy; 2025 QuickDrop. Alle rechten voorbehouden.
        </p>
      </div>
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