//server.js
const express = require('express');
const axios = require('axios');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');
const { sendEmailToUser, sendEmail, sendWelcomeEmail } = require('./api/emails');
const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const { fetchHistoricalStockData, combineQuotesWithPortfolios } = require('./api/stocks');

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



app.get('/api', async (req, res) => {
    res.send('API is running');
});

app.post('/create-checkout-session', async (req, res) => {
  // Create a Stripe customer with the UID as the description
  const customer = await stripe.customers.create({
    description: uid,
  });

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    line_items: [
      {
        price: 'prod_OyDINpJTInrPs3',
        quantity: 1,
      },
    ],
    mode: 'subsciption',
    success_url: 'https://www.finlister.com/success',
    cancel_url: 'https://www.finlister.com/upgrade',
  });

  res.send({url: session.url});
});

// Handle Stripe webhook for payment success
app.post('/stripe-success', async (req, res) => {
  try {
    const event = req.body;

    // Verify the event to ensure it's from Stripe
    const stripeEvent = stripe.webhooks.constructEvent(
      req.rawBody,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;

      // Extract the Stripe customer ID from the session
      const customerId = session.customer;

      // Find the user's Firestore document by the Stripe customer ID
      const userDocRef = admin.firestore().collection('users').doc(customerId);

      // Update the "premium" field in the Firestore document
      await userDocRef.update({ premium: true });

      // Respond to the webhook request
      res.status(200).send('Payment success webhook received and user updated to premium.');
    } else {
      res.status(400).send('Invalid webhook event type.');
    }
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).send('Error processing Stripe webhook.');
  }
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

// Endpoint to fetch subcollections for a user
app.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get references to the "portfolios" and "stocks" subcollections
    const portfoliosCollection = admin.firestore().collection('users').doc(userId).collection('portfolios');
    const stocksCollection = admin.firestore().collection('users').doc(userId).collection('stocks');

    // Fetch portfolios with emailAlerts set to true
    const portfoliosQuerySnapshot = await portfoliosCollection.where('emailAlerts', '==', true).get();
    const portfoliosData = [];

    // Iterate over portfolios with emailAlerts
    for (const portfolioDoc of portfoliosQuerySnapshot.docs) {
      const portfolioData = portfolioDoc.data();
      portfolioData.stocks = [];

      // Fetch associated stocks for this portfolio
      const stocksQuerySnapshot = await stocksCollection.where('portfolioId', '==', portfolioDoc.id).get();
      stocksQuerySnapshot.forEach((stockDoc) => {
        const stockData = stockDoc.data();
        // Include only basic information for each stock
        portfolioData.stocks.push({ stock: stockData.stock, quantity: stockData.quantity });
      });

      // Include portfolio name and associated stocks in the response
      if (portfolioData.stocks.length > 0) {
        portfoliosData.push({ name: portfolioData.name, stocks: portfolioData.stocks });
      }
    }

    // get unique stocks from portfolios
    let uniqueStocks = [];
    portfoliosData.forEach(portfolio => {
      portfolio.stocks.forEach(stock => {
        if(!uniqueStocks.includes(stock.stock)){
          uniqueStocks.push(stock.stock);
        }
      })
    })

    // get stock quotes
    const quoteFull = await fetchHistoricalStockData(uniqueStocks, '95d');

    // // add stock quotes to portfoliosData
    const portfolioDataTable = combineQuotesWithPortfolios(quoteFull, portfoliosData);

    // Send the email
    await sendEmail(portfolioDataTable, sgMail, 'stuartsim.aus+testing@gmail.com');

    res.json('Email sent.');
  } catch (error) {
    console.error('Error fetching portfolios with alerts:', error);
    res.status(500).send('Error fetching portfolios with alerts');
  }
});



