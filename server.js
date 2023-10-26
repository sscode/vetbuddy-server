const express = require('express');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const cron = require('node-cron');
require('dotenv').config()
const cors = require('cors');

const app = express();
const port = 5050;

app.listen(port, () => console.log(`Server running on port ${port}`));
app.use(express.json());
app.use(cors());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


app.get('/api', async (req, res) => {
    res.send('API is running');
});

app.get('/stock', async (req, res) => {
  const baseUrl = 'https://api.iex.cloud/v1/data/core/historical_prices/';

  const token = process.env.IEXCLOUD_API_KEY;

  const { symbol, range } = req.query;

  const response = await axios.get(`${baseUrl}${symbol}?range=${range}&token=${token}`);

  res.send(response.data);
});

app.get('/stockQuote', async (req, res) => {
  const baseUrl = 'https://api.iex.cloud/v1/data/core/quote/';

  const token = process.env.IEXCLOUD_API_KEY;

  const { symbolList } = req.query;

  const response = await axios.get(`${baseUrl}${symbolList}?token=${token}`);

  res.send(response.data);
});

const emailMessage = {
  to: 'stuartsim.aus+trainingstats@gmail.com',
  from: 'stuartsim.aus@gmail.com',
  subject: 'Logging Connection',
  text: 'This is a scheduled email Local.',
  html: '<strong>This is a scheduled email.</strong>',
};

// Schedule the email to be sent every 5 minutes
// cron.schedule('*/1 * * * *', () => {
//   sgMail
//     .send(emailMessage)
//     .then(() => {
//       console.log('Email sent');
//     })
//     .catch((error) => {
//       console.error('Error sending email:', error);
//     });
// });



// const response = await axios.get(`https://www.strava.com/api/v3/athlete?access_token=${accessToken}`);

// const { athleteDetails } = req.body; // Extract "text" from the request body

// const response = {
//   data: {
//     "user": athleteDetails
//   }
// };

app.get('/send-email', async (req, res) => {
  try {
      const msg = {
          to: 'stuartsim.aus+trainingstats@gmail.com',
          from: 'stuartsim.aus@gmail.com',
          subject: 'Logging Connection',
          text: 'This is a scheduled email Vercel.', // Replace with your email content
          html: '<strong>This is a scheduled email.</strong>', // Replace with your email content
      };

      await sgMail.send(msg);

      console.log('Email sent');
      res.send('Email sent successfully');
  } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).send('Error sending email');
  }
});


