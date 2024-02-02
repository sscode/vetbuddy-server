//server.js
const express = require('express');
const axios = require('axios');
const AWS = require('aws-sdk');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');
const { sendEmailToUser, sendEmail, sendWelcomeEmail } = require('./api/emails');
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const { createClient } = require("@deepgram/sdk");

const OpenAI = require('openai').OpenAI;
const openai = new OpenAI(process.env.OPENAI_API_KEY);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const deepgram = createClient(process.env.DEEPGRAM_SECRET);

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});


const app = express();
const port = 5050;

app.listen(port, () => console.log(`Server running on port ${port}`));
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());

app.get('/api', async (req, res) => {
    res.send('API is running');
});

app.get('/deepgram', async (req, res) => {
  const audioUrl = req.query.url; // Retrieve the URL from the query parameter

  if (!audioUrl) {
    return res.status(400).send('No URL provided');
  }

  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      { url: audioUrl },
      { model: "nova" },
    );

    if (error) {
      console.error(error);
      return res.status(500).send(error);
    }
    
    return res.send(result);
  } catch (error) {
    console.error('Error processing transcription:', error);
    res.status(500).json({ message: 'Error processing transcription' });
  }
});

app.get('/testBuckets', async (req, res) => {
  try {
    const data = await s3.listBuckets().promise();
    console.log(data);
    res.send(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listing buckets' });
  }
});


app.get('/generate-upload-url', async (req, res) => {
  const key = `recordings/${Date.now()}.wav`;
  const params = {
    Bucket: 'vetbuddy',
    Key: key, // File name you want to save as
    ContentType: 'audio/wav'
  };

  try {
    const uploadURL = await s3.getSignedUrlPromise('putObject', params);
    res.json({ uploadURL, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating upload URL' });
  }
});

app.post('/openai', async (req, res) => {
  const transcript = req.body.transcript;

  // console.log(transcript);

  const completion = await openai.chat.completions.create({
    messages: [
      {
        "role": "system",
        "content": "You are a helpful Veterinarian with expert knowledge on all types of animals. You will receive a transcript of a conversation between a vet and the owner of the pet. Your job is to turn the transcript into a consult that the vet can review.\n\nReview the transcript. Then create a consult write up which includes the following sections.\n\n\n1. Patient Information.\n2. Reason for Visit.\n3. History and Presenting Complaints.\n4. Physical Examination.\n5. Assessment and Plan.\n6. Additional Notes.\n7. Next Appointment. If there is any information missing, write that more information is needed. Do not include anything is unrelated to the reason for the visit and does not provide any medical information about the animal."
      },
      {
        "role": "user",
        "content": transcript,
      },
    ],
    model: "gpt-3.5-turbo",
  });

    // Accessing the 'content' from the first choice's message
    const content = completion.choices[0].message.content;

    sendEmail(sgMail, 'stuartsim.aus+1@gmail.com', 'Consult', content);

    console.log(content);

    // Sending only the 'content' in the response
    res.json({ text: content });
    } 
);


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



