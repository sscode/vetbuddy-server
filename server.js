//server.js
const express = require('express');
const axios = require('axios');
const AWS = require('aws-sdk');
require('dotenv').config()
const cors = require('cors');
const fs = require('fs');
const FormData = require('form-data');
const sgMail = require('@sendgrid/mail');
const bodyParser = require('body-parser');
const { createClient } = require("@deepgram/sdk");
const textPromptStart = require('./api/prompt');
const textPromptEnd = require('./api/prompt');
const { sendEmail } = require('./api/emails');

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
app.use(cors({
  origin: 'https://www.vetbuddy.co', // or an array of allowed origins
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
}));
app.use(bodyParser.json());

app.get('/api', async (req, res) => {
    res.send('API is running');
});

app.get('/deepgram', async (req, res) => {
  const audioUrl = req.query.url; // Retrieve the URL from the query parameter

  console.log('audioUrl:', audioUrl);


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
    console.log('Deepgram successful')
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
    console.log('generate-upload-url success:', uploadURL);
    res.json({ uploadURL, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating upload URL' });
  }
});

app.post('/openai', async (req, res) => {
  const transcript = req.body.transcript;
  const middleTextPrompt = req.body.textForAPI;

  //create prompt
  const fullPrompt = textPromptStart + middleTextPrompt + textPromptEnd

  // console.log(transcript);

  const completion = await openai.chat.completions.create({
    messages: [
      {
        "role": "system",
        "content": fullPrompt,
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

    console.log('openai success: ', content);

    // Sending only the 'content' in the response
    res.json({ text: content });
    } 
);


app.get('/testConnection', async (req, res) => {
  try {

    // console.log('Connection successful: ' + usersQuerySnapshot);

    res.send('Connection successful: ');
  } catch (error) {
    console.error('Error connecting', error);
    res.status(500).send('Error connecting');
  }
});



