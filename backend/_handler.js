import express from 'express';
import twitterWebhooks from 'twitter-webhooks';
import { defaultHandler } from '@reshuffle/server-function';
const devDBAdmin = require('@reshuffle/db-admin');

import { getTweets } from './twitterBackend';

const autohookConfig = {
  token: process.env.TWITTER_ACCESS_TOKEN,
  token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  env: process.env.TWITTER_WEBHOOK_ENV,
};

const twitterToken = process.env.TWITTER_API_BEARER;

const app = express();
app.use(express.json());
app.set('json spaces', 2)
// app.set('trust proxy', true);

// const userActivityWebhook = twitterWebhooks.userActivity({
//   serverUrl: 'https://b996c5ac.ngrok.io',
//   route: '/twitter-event',
//   consumerKey: process.env.TWITTER_CONSUMER_KEY,
//   consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
//   accessToken: process.env.TWITTER_ACCESS_TOKEN,
//   accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
//   environment: 'hidereplies',
//   app,
// });

// userActivityWebhook.register();

// userActivityWebhook.subscribe({
//   userId: '846648351907106817',
//   accessToken: process.env.TWITTER_ACCESS_TOKEN,
//   accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
// })
// .then(function (userActivity) {
//   console.log('hello');
//   userActivity
//     .on('favorite', (data) => console.log (userActivity.id + ' - favorite'))
//     .on ('tweet_create', (data) => console.log (userActivity.id + ' - tweet_create'))
//     .on ('follow', (data) => console.log (userActivity.id + ' - follow'))
//     .on ('mute', (data) => console.log (userActivity.id + ' - mute'))
//     .on ('revoke', (data) => console.log (userActivity.id + ' - revoke'))
//     .on ('direct_message', (data) => console.log (userActivity.id + ' - direct_message'))
//     .on ('direct_message_indicate_typing', (data) => console.log (userActivity.id + ' - direct_message_indicate_typing'))
//     .on ('direct_message_mark_read', (data) => console.log (userActivity.id + ' - direct_message_mark_read'))
//     .on ('tweet_delete', (data) => console.log (userActivity.id + ' - tweet_delete'))
// });

// userActivityWebhook.on ('unknown-event', (rawData) => console.log (rawData));


app.get('/user-tweets', async (req, res) => {
  const tweets = await getTweets('ashevat', twitterToken);
  console.log(tweets);
  res.status(200).json(tweets);
});


app.use(defaultHandler);

export default app;
