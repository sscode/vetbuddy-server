const express = require('express');
const axios = require('axios');
const sgMail = require('@sendgrid/mail');
const admin = require('firebase-admin');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');

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


// Define a function to send the email
async function sendEmail(portfolioData, email) {
  try {
    const text = 'This is a scheduled email Vercel.';
    const msg = {
      to: email,
      from: 'stuartsim.aus@gmail.com',
      subject: 'Logging Connection Vercel',
      html: generateEmailContent(portfolioData), // Replace with your email content
    };

    await sgMail.send(msg);

    console.log('Email sent');
  } catch (error) {
    console.error('Error sending email:', error);
    throw error; // Re-throw the error for handling at a higher level if needed
  }
}

function generateEmailContent(portfoliosData) {

  const now = new Date();
  const options = {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Use 24-hour format
  };
  
  const timeStamp = now.toLocaleDateString('en-US', options);
  
  const fullEmailTemplate = fs.readFileSync('templates/index.html', 'utf8'); // Read full email template from file

  // Create an array to store individual table HTML for each portfolio
  const portfolioTables = [];

  // Loop through each portfolio in the response
  portfoliosData.forEach((portfolio) => {
    let tableHTML = `
    <h1 class="v-font-size" style="margin: 0px; margin-bottom: 2px; line-height: 140%; text-align: left; word-wrap: break-word; font-size: 22px; font-weight: 400;">
    ${portfolio.name}
    </h1>`
    ; // Portfolio name as a heading
    tableHTML += `<p style="margin-bottom: 24px;">Generated at ${timeStamp}</p>`; // Timestamp
    tableHTML += '<table style="margin-bottom: 24px">'; // Start a table

    // Add a header row
    tableHTML += `
      <tr style="">
        <th style="padding-vertical: 5px; padding-right: 25px; padding-left: 10px; border: none; background-color: #f0f0f0;">Stock</th>
        <th style="padding-vertical: 5px; padding-right: 25px; padding-left: 10px;border: none; background-color: #f0f0f0;">QTY</th>
      </tr>
    `;

    // Loop through each stock in the portfolio
    portfolio.stocks.forEach((stock) => {
      tableHTML += `
        <tr style="border-bottom: 1px solid #ccc;">
          <td style="padding-vertical: 5px; padding-right: 25px; padding-left: 10px; border: none;">${stock.stock}</td> <!-- Stock symbol -->
          <td style="padding-vertical: 5px; padding-right: 25px; padding-left: 10px; border: none;">${stock.quantity}</td> <!-- Quantity -->
        </tr>
      `;
    });

    tableHTML += '</table>'; // End the table for the portfolio

    // Push the generated table HTML into the array
    portfolioTables.push(tableHTML);
  });

  // Join all the portfolio tables into a single string
  const tableContent = portfolioTables.join('');

  // Replace the placeholder in the email template with the generated table content
  const emailContent = fullEmailTemplate.replace('%TABLE_CONTENT%', tableContent);

  return emailContent;
}

// Endpoint to fetch subcollections for a user
async function sendEmailToUser(userId) {

  try {
    //get email address
    // Fetch the user's email from Firestore
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    let userEmail = userDoc.data().email;

    console.log('userEmail', userEmail);

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

    if(userEmail !== 'stuartsim.aus+firebase@gmail.com'){
      userEmail = 'stuartsim.aus+alternate@gmail.com'
    }

    // Send the email
    await sendEmail(portfoliosData, userEmail);

    // res.json(portfoliosData);
  } catch (error) {
    console.error('Error fetching portfolios with alerts:', error);
    // res.status(500).send('Error fetching portfolios with alerts');
  }
};


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
        await sendEmailToUser(userDoc.id);
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

    console.log('Connection successful: ' + usersQuerySnapshot);

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

    // Send the email
    await sendEmail(portfoliosData, 'stuartsim.aus+testing@gmail.com');

    res.json(portfoliosData);
  } catch (error) {
    console.error('Error fetching portfolios with alerts:', error);
    res.status(500).send('Error fetching portfolios with alerts');
  }
});