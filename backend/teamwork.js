import { update, get, find, Q, remove } from '@reshuffle/db';

import { createWorksheetByTitle } from './sheet';

const tmAPIKey = process.env.TEAMWORK_API_KEY;
const tmSubdomain = process.env.TEAMWORK_SUBDOMAIN;
const tw = require('teamwork-api')(tmAPIKey, tmSubdomain);

const { NODE_ENV } = process.env;
const isProd = NODE_ENV === 'prod' || NODE_ENV === 'production';

const localUrl = process.env.LOCAL_URL;
const remoteUrl = `https://${process.env.RESHUFFLE_APPLICATION_DOMAINS}`;

const webhookUrl = isProd ? remoteUrl : localUrl;

const { projects } = tw;
const { webhooks } = tw;

const eventsKey = 'events_';
const hooksKey = 'hook_';

/* @expose */
export async function buildEventCatalog() {
  const { events } = await webhooks.getEvents();
  for (let i = 0; i < events.length; i += 1) {
    const { id, name } = events[i];
    await update(`${eventsKey}${id}`, () =>
      events[i]);
  }
  return events;
}

async function eventById(id) {
  return await get(`${eventsKey}${id}`);
}

async function hookById(id) {
  return await get(`${hooksKey}${id}`);
}

export async function hookByName(eventName) {
  const allHooks = await find(
    Q.filter(
      Q.all(
        Q.key.startsWith(hooksKey),
        Q.value.name.eq(eventName),
      ),
    )
  );
  return allHooks.map(({ value }) => value)[0];
}

/* @expose */
export async function getAllHooks() {
  const allHooks = await find(
    Q.filter(
      Q.key.startsWith(hooksKey)
    )
  );
  return allHooks.map(({ value }) => value);
}

export async function removeAllHooks() {
  const allHooks = await find(
    Q.filter(Q.key.startsWith(hooksKey))
  );
  for (let i = 0; i < allHooks.length; i += 1) {
    const id = allHooks[i].value.id;
    await webhooks.delete(id);
    await remove(allHooks[i].key);
  }
  return allHooks.length;
}

/* @expose */
export async function removeWebhook(eventId) {
  const allHooks = await find(
    Q.filter(
      Q.all(
        Q.key.startsWith(hooksKey),
        Q.value.eventId.eq(eventId),
      ),
    )
  );

  if (!allHooks.length) {
    throw new Error(`Webhook ${eventId} not registered registered`);
  }

  const { id } = allHooks[0].value;
  await webhooks.delete(id);
  await remove(allHooks[0].key);
  return eventId;
}

/* @expose */
export async function registerWebhook(eventId) {
  const event = await eventById(eventId);
  if (!event) {
    throw new Error(`No event matches id ${eventId}`);
  }
  const { name } = event;
  const hasHook = await hookById(eventId);
  if (hasHook) {
    throw new Error(`Webhook ${name} already registered`);
  }

  const url = `${webhookUrl}/${name}`;
  const { id } = await webhooks.create({
    webhook: {
      event: name,
      url,
    },
  });
  return await update(`${hooksKey}${id}`, (old) =>
    ({ name, url, id, eventId }));
};
