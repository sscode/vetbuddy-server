const express = require('express');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
require('dotenv').config()

const app = express();
const port = 5050;
app.listen(port, () => console.log(`Server running on port ${port}`));

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


app.get('/api', async (req, res) => {
    res.send('API is running');

});

app.get('/send-email', async (req, res) => {
    // const response = await axios.get(`https://www.strava.com/api/v3/athlete?access_token=${accessToken}`);

    const response = {data: {
        "id": 227615,
        "username": "stuartsim",
        "resource_state": 2,
    }}

    const msg = {
      to: 'stuartsim.aus+trainingstats@gmail.com',
      from: 'stuartsim.aus@gmail.com',
      subject: 'Athlete Data',
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

