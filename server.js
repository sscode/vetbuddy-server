//server.js
const express = require('express');
const axios = require('axios');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');
const { sendEmailToUser, sendEmail, sendWelcomeEmail } = require('./api/emails');
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');

const OpenAI = require('openai').OpenAI;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);


const app = express();
const port = 5050;

app.listen(port, () => console.log(`Server running on port ${port}`));
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

app.get('/api', async (req, res) => {
    res.send('API is running');
});

app.get('/openai', async (req, res) => {
  // const { prompt } = req.query;

  const completion = await openai.chat.completions.create({
    messages: [
      {
        "role": "system",
        "content": "You are a helpful Veterinarian with expert knowledge on all types of animals. You will receive a transcript of a conversation between a vet and the owner of the pet. Your job is to turn the transcript into a consult that the vet can review.\n\nReview the transcript. Then create a consult write up which includes the following sections.\n\n\n1. Patient Information.\n2. Reason for Visit.\n3. History and Presenting Complaints.\n4. Physical Examination.\n5. Assessment and Plan.\n6. Additional Notes.\n7. Next Appointment."
      },
      {
        "role": "user",
        "content": "Dog Owner: Good morning, Dr. VetGPT! This is Charlie, my Golden Retriever. We're here for his annual checkup.\n\nVetGPT: Good morning! It's great to see Charlie again. How has he been doing?\n\nDog Owner: He's been doing well, but I've noticed he's been scratching a lot more recently.\n\nVetGPT: I see. It could be allergies or a skin condition. I'll take a closer look. How about his eating and exercise habits?\n\nDog Owner: He's eating well, but I've been wondering if I'm giving him the right kind of food.\n\nVetGPT: Diet is very important. We'll discuss some nutrition options today. And exercise?\n\nDog Owner: We go for walks twice a day, but he seems to tire out more quickly now.\n\nVetGPT: Aging can affect their energy levels. We'll do a heart and lung check to ensure everything is okay. How about his teeth and gums?\n\nDog Owner: I try to brush them, but it's a struggle.\n\nVetGPT: Dental health is crucial for dogs. Let's examine his teeth, and I can show you some techniques for brushing.\n\nDog Owner: That would be helpful. Also, he's due for his vaccinations, right?\n\nVetGPT: Yes, we'll update his vaccinations today. It's also a good time to discuss flea and tick prevention.\n\nDog Owner: Oh, right. I want to make sure he's protected.\n\nVetGPT: Absolutely. After the examination, we'll talk about all the preventive care options. Any other concerns or questions?\n\nDog Owner: No, that's everything for now. Thanks for being so thorough, Dr. VetGPT!\n\nVetGPT: You're welcome! It's important for Charlie to have comprehensive care. Let's start with the examination now."
      },
    ],
    model: "gpt-4",
  });

  res.send(completion);
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


app.get('/testConnection', async (req, res) => {
  try {

    // console.log('Connection successful: ' + usersQuerySnapshot);

    res.send('Connection successful: ');
  } catch (error) {
    console.error('Error connecting', error);
    res.status(500).send('Error connecting');
  }
});



