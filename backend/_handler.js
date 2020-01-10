import { update, Q, find, remove, get } from '@reshuffle/db';

import express from 'express';
import fetch from 'node-fetch';
import { defaultHandler } from '@reshuffle/server-function';
import devDBAdmin from '@reshuffle/db-admin';

import { removeAllHooks, hookByName } from './teamwork';

import { addWSEntry } from './sheet';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('json spaces', 2)

app.all('/remove-all-hooks', async (req, res) => {
  const numRemoved = await removeAllHooks();
  res.status(200).json(`Removed ${numRemoved} hooks`);
});

app.use('*', async (req, res, next) => {
  const searchPath = req.originalUrl;
  const eventName = searchPath.slice(1, searchPath.length);
  const hookExists = await hookByName(eventName);
  if (hookExists) {
    const sheetName = `${eventName} events`;
    const eventType = req.headers['x-projects-event'];
    const eventBase = eventType.split('.')[0].toLowerCase();
    const relevantBody = req.body[eventBase];
    const workSheet =
      await addWSEntry(sheetName, relevantBody);
    res.status(200).json('ok');
  } else {
    next();
  }
});

app.use(defaultHandler);

export default app;
