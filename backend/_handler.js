import { update, Q, find, remove, get } from '@reshuffle/db';

import express from 'express';
import { defaultHandler } from '@reshuffle/server-function';
import { devDBAdminHandler } from '@reshuffle/db-admin';

import {
  watchSheet,
  stopWatchingAllChannels,
} from './drive';
import {
  getAllTasksForProject,
  removeAllHooks,
  hookByName,
  handleMaybeTask,
  setTaskSync,
  maybeBroadcast,
} from './teamwork';
import { addWSEntry } from './sheet';
import { getUrl } from './getUrl';

const baseUrl = getUrl();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('json spaces', 2)

app.use('/dev/db-admin', devDBAdminHandler);

app.all('/remove-all-hooks', async (req, res) => {
  const numRemoved = await removeAllHooks();
  res.status(200).json(`Removed ${numRemoved} hooks`);
});

const sheetRoute = '/sheet-notification';
const sheetHookUrl = `${baseUrl}${sheetRoute}`;

watchSheet(process.env.SPREADSHEET_ID, sheetHookUrl);
// stopWatchingAllChannels();

app.all(sheetRoute, async (req, res) => {
  console.log(`message # is ${req.headers['x-goog-message-number']}`);
  await maybeBroadcast();
  res.status(200).json('ok');
});

app.all('/broadcast', async (req, res) => {
  await maybeBroadcast();
  res.status(200).json('ok');
});

app.all('/enable-task-check', async (req, res) => {
  await setTaskSync(true);
  res.status(200).json('ok');
});

app.all('/disable-task-check', async (req, res) => {
  await setTaskSync(false);
  res.status(200).json('ok');
});

// Uncomment to verify domain with google
// app.all('/google834ab8865145d8f9.html', async (req, res) => {
//   res.sendFile(__dirname + '/google834ab8865145d8f9.html');
//   res.sendFile('/home/ubuntu/teamwork-app/backend/google834ab8865145d8f9.html');
// });

app.use('*', async (req, res, next) => {
  const searchPath = req.originalUrl;
  const eventName = searchPath.slice(1, searchPath.length);
  const hookExists = await hookByName(eventName);
  if (!hookExists) {
    next();
    return;
  }
  const eventType = req.headers['x-projects-event'];
  const eventBase = eventType.split('.')[0].toLowerCase();
  const relevantBody = req.body[eventBase];
  await handleMaybeTask(hookExists, relevantBody);
  const sheetName = `${eventName} events`;
  const workSheet =
    await addWSEntry(sheetName, relevantBody);
  res.status(200).json('ok');
});

app.use(defaultHandler);

export default app;
