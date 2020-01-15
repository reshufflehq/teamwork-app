import { update, get, find, Q, remove } from '@reshuffle/db';

import { getUrl } from './getUrl';
import {
  addRowsBulk,
  addWSEntry,
  createAndClearWS,
  createWorksheetByTitle,
  getAllWSRows,
} from './sheet';

const tmAPIKey = process.env.TEAMWORK_API_KEY;
const tmSubdomain = process.env.TEAMWORK_SUBDOMAIN;
const tw = require('teamwork-api')(tmAPIKey, tmSubdomain);

const webhookUrl = getUrl();

const { projects } = tw;
const { webhooks } = tw;
const { tasks } = tw;

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
      version: 2,
      contentType: 'application/json',
    },
  });
  return await update(`${hooksKey}${id}`, (old) =>
    ({ name, url, id, eventId }));
};

const taskSyncKey = 'task_sync';
const tasksKey = 'storedtask_';

const projectId = process.env.TEAMWORK_PROJECT_ID;

const taskFields = [
  'id',
  'content',
  'description',
  'priority',
  'status',
  'due-date',
  'progress',
  'completed',
];

const sheetFields = [
  'Id',
  'name',
  'description',
  'priority',
  'status',
  'dueDate',
  'progress',
  'completed',
];

const eventTaskFields = [
  'id',
  ...sheetFields.slice(1, sheetFields.length),
];

const taskEventIds = [
  '1', // created
  '2', // updated
  // '3', // deleted
  // '4', // completed
  '5', // reopened
];

const taskSheetTitle = `tasks-${projectId}`;

export async function getAllTasksForProject() {
  const tasks = await projects.getTasks(projectId);
  return tasks['todo-items'];
}

/* @expose */
export async function getTaskSync() {
  return await get(`${taskSyncKey}${projectId}`) || false;
}

function makeTaskRow(data) {
  const handleNull = (val) => {
    return val === null ? undefined : val;
  };
  return eventTaskFields.reduce((aggr, curr) => {
    if (curr === 'id') {
      aggr['Id'] = handleNull(data[curr]);
    } else if (curr === 'completed') {
      const denulled = handleNull(data[curr]);
      aggr[curr] = denulled === undefined ?
        'FALSE' : denulled;
    } else {
      aggr[curr] = handleNull(data[curr]);
    }
    return aggr;
  }, {});
}

export async function handleMaybeTask(hook, body) {
  const taskSync = await getTaskSync();
  if (!taskSync) {
    return;
  }
  const { eventId } = hook;
  if (!taskEventIds.includes(eventId)) {
    return;
  }

  const taskOp = hook.name.slice(5, hook.name.length);
  if (taskOp === 'CREATED') {
    const insertRow = makeTaskRow(body);
    const workSheet =
      await addWSEntry(taskSheetTitle, insertRow);
    const castRow = { ...insertRow };
    Object.keys(castRow).forEach((key) => {
      if (castRow[key] === null) {
        castRow[key] = '';
      }
    });
    await update(`${tasksKey}${projectId}${body.id}`,
      () => castRow);
  } else if (taskOp === 'UPDATED') {
  } else if (taskOp === 'REOPENED') {

  }
}

const createOrderedRows = (data) => {
  return data.map((fields) => {
    const row = [null, ...(taskFields).map((taskField) =>
      fields[taskField])];
    return row;
  });
}

/* @expose */
export async function setTaskSync(taskSync) {
  await update(`${taskSyncKey}${projectId}`,
    (oldSync) => taskSync);
  if (taskSync) {
    const allTasks = await getAllTasksForProject();
    const ws = await createAndClearWS(taskSheetTitle, sheetFields);
    const orderedRows = createOrderedRows(allTasks);

    for (let i = 0; i < orderedRows.length; i += 1) {
      const task = orderedRows[i].slice(1, orderedRows[i].length);
      const taskEntry = task.reduce((aggr, curr, idx) => {
        const field = sheetFields[idx];
        aggr[field] = curr;
        return aggr;
      }, {});
      await update(`${tasksKey}${projectId}${taskEntry.Id}`, () =>
        taskEntry);
    }
    await addRowsBulk(ws, orderedRows);
    const existingHooks = await find(
      Q.filter(
        Q.key.startsWith(hooksKey),
      ),
    );
    const newHookIds = taskEventIds.filter((id) =>
      !existingHooks.some(({ value }) =>
        value.eventId === id));
    await Promise.all(newHookIds.map((id) =>
      registerWebhook(id)));
  }
}

const fieldMap = {
  id: 'Id',
  name: 'name',
  description: 'description',
  priority: 'priority',
  status: 'status',
  duedate: 'dueDate',
  progress: 'progress',
  completed: 'completed',
};

const convertSheetBool = (maybeBool) => {
  if (maybeBool === 'TRUE') {
    return true;
  }
  return false;
};

/* @expose */
export async function maybeBroadcast() {
  const rows = await getAllWSRows(taskSheetTitle);
  const formatted = rows.map((row) => {
    const formattedRow = {};
    Object.keys(fieldMap).forEach((field) => {
      const translated = fieldMap[field];
      if (translated === 'Id') {
        formattedRow[translated] = parseInt(row[field], 10);
      } else if (translated === 'completed') {
        formattedRow[translated] = convertSheetBool(row[field]);
      } else {
        formattedRow[translated] = row[field];
      }
    });
    return formattedRow;
  });
  const storedRowPairs = await find(
    Q.filter(
      Q.key.startsWith(`${tasksKey}${projectId}`),
    ),
  );
  const storedRows = storedRowPairs.map(({ value }) =>
    value);
  const updates = formatted.filter((row) => {
    const rowId = row.Id;
    const matchingRow = storedRows.filter(({ Id }) =>
      rowId === Id)[0];
    if (matchingRow && row.completed !== matchingRow.completed) {
      return true;
    }
    return false;
  });
  for (let i = 0; i < updates.length; i += 1) {
    const newVers = updates[i];
    const { completed, Id } = newVers;
    if (completed) {
      await tasks.complete(Id);
    } else {
      await tasks.incomplete(Id);
    }
    await update(`${tasksKey}${projectId}${newVers.Id}`,
      (old) => ({ ...old, completed }));
  }
}
