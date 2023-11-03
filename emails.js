//emails.js
const fs = require('fs');

    // Define a function to send the email
    async function sendEmail(portfolioData, sgMail, email) {

        try {
        const msg = {
            to: email,
            from: 'stuartsim.aus@gmail.com',
            subject: 'Finlister Portfolio Update',
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
  async function sendEmailToUser(admin, sgMail, userId) {
  
    try {
      //get email address
      // Fetch the user's email from Firestore
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      let userEmail = userDoc.data().email;
    
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
      await sendEmail(portfoliosData, sgMail, userEmail);
  
      // res.json(portfoliosData);
    } catch (error) {
      console.error('Error fetching portfolios with alerts:', error);
      // res.status(500).send('Error fetching portfolios with alerts');
    }
  };

  module.exports = { sendEmailToUser };