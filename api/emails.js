//emails.js
const fs = require('fs');
const { combineQuotesWithPortfolios, fetchHistoricalStockData } = require('./stocks');
const footer = require('./templates/footer');
const header = require('./templates/header');

    // Define a function to send the email
    async function sendEmail(sgMail, email, subject, content) {

        try {
        const msg = {
            to: email,
            from: 'stuartsim.aus@gmail.com',
            subject: subject,
            html: content,
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
        </h1>
        `; // Portfolio name as a heading
        tableHTML += `<p style="margin-bottom: 24px; text-align: left;">Generated at ${timeStamp}</p>`; // Timestamp
        tableHTML += '<table style="margin-bottom: 24px">'; // Start a table
    
        // Add a header row
        tableHTML += `
          <tr style="">
            <th class="th-header">Stock</th>
            <th class="th-header">QTY</th>
            <th class="th-header">Latest Price</th>
            <th class="th-header">Weight (%)</th>
            <th class="th-header">Total Value</th>
            <th class="th-header">Yesterday (%)</th>
            <th class="th-header">30 Days (%)</th>
            <th class="th-header">90 Days (%)</th>
          </tr>
        `;
    
        // Loop through each stock in the portfolio
        portfolio.stocks.forEach((stock) => {
          tableHTML += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
              <td class="td-cell td-stock">${stock.symbol}</td> <!-- Stock symbol -->
              <td class="td-cell">${stock.quantity}</td> <!-- Quantity -->
              <td class="td-cell">$${stock.latestPrice}</td> <!-- Latest Price -->
              <td class="td-cell">${stock.weight.toFixed(0)}%</td> <!-- Weight -->
              <td class="td-cell">$${stock.totalValue.toFixed(0)}</td> <!-- Total Value -->
              <td class="td-cell">${stock.PriceChangePercentageYesterday.toFixed(2)}%</td> <!-- Price Change Yesterday (%) -->
              <td class="td-cell">${stock.PriceChangePercentageThirty.toFixed(2)}%</td> <!-- Price Change Last 30 Days (%) -->
              <td class="td-cell">${stock.PriceChangePercentageNinety.toFixed(2)}%</td> <!-- Price Change Last 90 Days (%) -->
            </tr>
          `;
        });
    
        tableHTML += '</table>'; // End the table for the portfolio
    
        // Push the generated table HTML into the array
        portfolioTables.push(tableHTML);
      });
    
      // Join all the portfolio tables into a single string
      const tableContent = portfolioTables.join('');

      const subtext = `View your portfolios and stocks here.`
    
      // Replace the placeholder in the email template with the generated table content
      const emailContent = fullEmailTemplate.replace('%TABLE_CONTENT%', tableContent);
      const emailContent2 = emailContent.replace('%SUB_TEXT%', subtext);
    
      return emailContent2;
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

      //get unique stocks from portfolios
      let uniqueStocks = [];
      portfoliosData.forEach(portfolio => {
        portfolio.stocks.forEach(stock => {
          if(!uniqueStocks.includes(stock.stock)){
            uniqueStocks.push(stock.stock);
          }
        })
      })

      //get stock quotes
      const quoteFull = await fetchHistoricalStockData(uniqueStocks, '95d');

      // add stock quotes to portfoliosData
      const portfolioDataTable = combineQuotesWithPortfolios(quoteFull, portfoliosData);
  
      if(userEmail !== 'stuartsim.aus+firebase@gmail.com'){
        userEmail = 'stuartsim.aus+alternate@gmail.com'
      }

      // Generate the email content
      const emailData = generateEmailContent(portfolioDataTable)
      const emailSubject = 'Finlister - Your Portfolio Summary'
  
      // Send the email
      await sendEmail(sgMail, userEmail, emailSubject, emailData);
  
      // res.json(portfoliosData);
    } catch (error) {
      console.error('Error fetching portfolios with alerts:', error);
      // res.status(500).send('Error fetching portfolios with alerts');
    }
  };

  //send welcome email
  async function sendWelcomeEmail(sgMail, userEmail) {

    const subject = 'Welcome to Finlister';

    const tableContent = `<p>Welcome to Finlister. Please confirm your email.</p>`
    const subtext = `Welcome to the best way to view your portfolio.`


    const fullEmailTemplate = fs.readFileSync('templates/index.html', 'utf8'); // Read full email template from file
    const headerTemplate = fs.readFileSync('templates/header.html', 'utf8'); // Read full email template from file
    const footerTemplate = fs.readFileSync('templates/footer.html', 'utf8'); // Read full email template from file

    let emailContent = fullEmailTemplate.replace('%TABLE_CONTENT%', tableContent);
    //add in header and footer
    emailContent = emailContent.replace('%HEADER%', header);
    emailContent = emailContent.replace('%FOOTER%', footer);
    emailContent = emailContent.replace('%SUB_TEXT%', subtext);


    await sendEmail(sgMail, userEmail, subject, emailContent);
    
    }

  module.exports = { sendEmailToUser, sendEmail, sendWelcomeEmail };