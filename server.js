const express = require('express');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
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
  const baseUrl = 'https://api.iexcloud.io/v1/data/core/historical_prices/';

  const token = process.env.IEXCLOUD_API_KEY;

  const { symbol, range } = req.query;

  const response = await axios.get(`${baseUrl}${symbol}?range=${range}&token=${token}`);

  res.send(response.data);
});


app.post('/send-email', async (req, res) => {
    // const response = await axios.get(`https://www.strava.com/api/v3/athlete?access_token=${accessToken}`);

    const { athleteDetails } = req.body; // Extract "text" from the request body

    const response = {
      data: {
        "user": athleteDetails
      }
    };

    const msg = {
      to: 'stuartsim.aus+trainingstats@gmail.com',
      from: 'stuartsim.aus@gmail.com',
      subject: 'TrainingStats Connectin',
      text: JSON.stringify(response.data),
      html: '<strong>' + JSON.stringify(response.data) + '</strong>',
    }

    sgMail
      .send(msg)
      .then(() => {
        console.log('Email sent');
        res.send('Email sent successfully');
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error sending email');
      });
});

