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

export async function createWorksheetByTitle(sheetTitle, headers) {
  const existing = await getWorksheetByTitle(sheetTitle);
  const addWSAsync = promisify(doc.addWorksheet);
  if (!existing) {
    const workSheet = await addWSAsync.call(doc, {
      title: sheetTitle,
      headers,
    });
    return workSheet;
  }
  return existing;
}

export async function addWSEntry(sheetTitle, kVData) {
  const headers = Object.keys(kVData);
  const worksheet = await createWorksheetByTitle(
    sheetTitle, headers);
  if (worksheet) {
    const addRowAsync = promisify(worksheet.addRow);
    await addRowAsync(kVData);
  }
}
