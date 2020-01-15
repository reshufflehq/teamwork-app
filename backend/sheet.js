import { promisify } from 'util';
import GoogleSpreadSheet from 'google-spreadsheet';

const credsPath = './teamwork-spreadsheet-creds.json';
const creds = require(credsPath);

const spreadsheetID = process.env.SPREADSHEET_ID;
const doc = new GoogleSpreadSheet(spreadsheetID);
const serviceAccAsync = promisify(doc.useServiceAccountAuth);
const getInfoAsync = promisify(doc.getInfo);

serviceAccAsync(creds).catch((err) => {
  console.error(err);
  console.error(`Failed to load google sheets creds`);
});

/* @expose */
export async function getSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetID}/`
}

export async function getExistingWorksheets() {
  const { worksheets } = await getInfoAsync();
  return worksheets;
}

export async function getWorksheetByTitle(sheetTitle) {
  const wS = await getExistingWorksheets();
  return wS.filter(({ title }) => title === sheetTitle)[0];
}

const createRowOptions = (data) => ({
  'return-empty': true,
  'max-col': data[0].length - 1,
  'min-row': 2,
  'max-row': data.length + 1,
});

const getCells = (doc, opts) => new Promise((resolve, reject) => {
  doc.getCells(opts, (err, cells) => {
    if (err) reject(err);
    resolve(cells);
  });
});

const getRows = (doc, opts) => new Promise((resolve, reject) => {
  doc.getRows(opts, (err, rows) => {
    if (err) reject(err);
    resolve(rows);
  });
});

const bulkUpdateCells = (doc, cells) => new Promise((resolve, reject) => {
  doc.bulkUpdateCells(cells, (err, upd) => {
    if (err) reject(err);
    resolve(upd);
  });
});

export async function addRowsBulk(worksheet, rows) {
  const opts = createRowOptions(rows);
  return getCells(worksheet, opts)
   .then((cells) => {
     cells.forEach((cell, i) => {
       try {
         cell.value = String(rows[cell.row - 2][cell.col]);
       } catch (e) {
         console.log(`NOT FOUND ${i} : R${cell.row} C${cell.col} rows:${rows.length}`);
       }
     });
     return bulkUpdateCells(worksheet, cells);
   });
};

export async function updateRowBulk(worksheet, row) {
  const doc = await getWorksheetByTitle(worksheet);
  if (!doc) {
    console.error(`No worsheet with title: ${worksheet} exists`);
    return;
  }
  const query = `id=${row.Id}`;
  const rows = await getRows(doc, {
    offset: 1,
    query: '(' + query + ')',
  });
  const sheetRow = rows[0];
  const keys = await Object.keys(row);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    sheetRow[key] = row[key];
  }
  const saveAsync = promisify(sheetRow.save);
  await saveAsync();
}

export async function getAllWSRows(sheetTitle) {
  const existing = await getWorksheetByTitle(sheetTitle);
  if (!existing) {
    throw new Error('No worksheet exists with that name');
  }
  const getRowsAsync = promisify(existing.getRows);
  return await getRowsAsync({
    offset: 1,
  });
}

export async function createWorksheetByTitle(sheetTitle, headers, clearFirst) {
  const existing = await getWorksheetByTitle(sheetTitle);
  const addWSAsync = promisify(doc.addWorksheet);
  if (!existing) {
    const workSheet = await addWSAsync.call(doc, {
      title: sheetTitle,
      headers,
    });
    return workSheet;
  } else if (clearFirst) {
    const clearAsync = promisify(existing.clear);
    await clearAsync();
    const resizeAsync = promisify(existing.resize);
    await resizeAsync({
      colCount: headers.length,
      rowCount: 10000,
    });
    const setHeaderAsync = promisify(existing.setHeaderRow);
    await setHeaderAsync(headers);
  }
  return existing;
}

export async function createAndClearWS(sheetTitle, headers) {
  return await createWorksheetByTitle(sheetTitle, headers, true);
}

export async function addWSEntry(sheetTitle, kVData) {
  let dataCopy = { ...kVData };
  if (dataCopy.id) {
    const id = dataCopy.id;
    delete dataCopy.id;
    dataCopy = { Id: id, ...dataCopy };
  }

  const headers = Object.keys(dataCopy);
  headers.forEach((key) => {
    const value = dataCopy[key];
    const jsonTypes = [undefined, null, [], ''];
    if (jsonTypes.includes(value) || Array.isArray(value)) {
      dataCopy[key] = JSON.stringify(dataCopy[key]);
    }
  });

  const worksheet = await createWorksheetByTitle(
    sheetTitle, headers);
  if (worksheet) {
    const addRowAsync = promisify(worksheet.addRow);
    await addRowAsync(dataCopy);
  }
}
