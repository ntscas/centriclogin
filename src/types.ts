export interface UserRow {
  phoneNumber: string; // acts as unique key
  password?: string;
  name: string;
  email: string;
  otherInfo: string;
  registeredDate: string;
  ncentric?: string; // New field for NCENTRIC status ('Y' or other values)
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}
