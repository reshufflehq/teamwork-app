import { Q, find, update, remove } from '@reshuffle/db';
import { google, drive_v3 } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

import { client_email, private_key } from './teamwork-spreadsheet-creds.json';

const auth = new google.auth.JWT(
  client_email,
  undefined,
  private_key,
  ['https://www.googleapis.com/auth/drive'],
);

const drive = google.drive({ version: 'v3', auth });

const channelsPrefix = 'channel_';

export async function stopWatching(chanId, resId) {
  try {
    await drive.channels.stop({
      resource : {
        id: chanId,
        resourceId: resId,
      }
    });
  } catch (err) {
    console.error(err);
  }
}

export async function stopWatchingAllChannels() {
  const chanQuery = await find(
    Q.filter(
      Q.key.startsWith(channelsPrefix),
    ),
  );
  for (let i = 0; i < chanQuery.length; i += 1) {
    const { key, value } = chanQuery[i];
    console.log(`Removing watched channel ${value.id}`);
    try {
      await stopWatching(value.id, value.resourceId);
      await remove(key);
    } catch (err) {
      console.error(err);
      console.log(`Failed to stop watching id: ${value.id}`);
    }
  }
}

export async function watchSheet(sheetId, webhookUrl) {
  await stopWatchingAllChannels();
  const channelId = uuidv4();
  const watched = await drive.files.watch({
    fileId: sheetId,
    resource: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
    },
  });
  const { resourceId, id } = watched.data;
  const chan = await update(`${channelsPrefix}${id}`, () =>
    ({ resourceId, id }));
  return channelId;
}
