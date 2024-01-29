//server.js
const express = require('express');
const axios = require('axios');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');
const { sendEmailToUser, sendEmail, sendWelcomeEmail } = require('./api/emails');
const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const Stripe = require('stripe');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    // Add your Firebase Admin SDK credentials here
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),  
    databaseURL: process.env.FIREBASE_DATABASE_URL,
}),
});
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);


const app = express();
const port = 5050;

app.listen(port, () => console.log(`Server running on port ${port}`));
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());



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

app.get('/stockDate', async (req, res) => {
  const baseUrl = 'https://cloud.iexapis.com/stable/stock/';
  // 'AAPL/chart/date/20211029?chartByDay=true&token=pk_12493ac929dc4aca8b9ca87d35fefc39';

  const token = process.env.IEXCLOUD_API_KEY;

  // const { symbol, date } = req.query;

  const symbol = 'AAPL';
  const date = '20210104';

  const response = await axios.get(`${baseUrl}${symbol}/chart/date/${date}?chartByDay=true&token=${token}`);

  res.send(response.data);
});

app.get('/sendWelcomeEmail', async (req, res) => {

  const { email } = req.query;
  // const email = 'stuartsim.aus+welcome@gmail.com'

  await sendWelcomeEmail(sgMail, email);

  res.send('Welcome email sent to ' + email);
})

// Endpoint to send emails to all users
app.get('/sendEmails', async (req, res) => {
  try {

    res.setHeader('Cache-Control', 'no-cache');

    // Fetch all user documents from the "users" collection
    const usersQuerySnapshot = await admin.firestore().collection('users').get();

    // Initialize a delay counter
    const delay = 250;
    
    for(const userDoc of usersQuerySnapshot.docs) {
      setTimeout(async() => {
        await sendEmailToUser(admin, sgMail, userDoc.id);
        console.log('Email sent to user:', userDoc.id);
      }, delay);
    }

    const timeStamp = new Date().toISOString();

    res.send(`Emails sent to all users at ${timeStamp}`);
  } catch (error) {
    console.error('Error sending emails to all users:', error);
    res.status(500).send('Error sending emails to all users');
  }
});

app.get('/testConnection', async (req, res) => {
  try {
    const usersQuerySnapshot = await admin.firestore().collection('users').get();

    // console.log('Connection successful: ' + usersQuerySnapshot);

    res.send('Connection successful: ' + usersQuerySnapshot);
  } catch (error) {
    console.error('Error connecting', error);
    res.status(500).send('Error connecting');
  }
});



