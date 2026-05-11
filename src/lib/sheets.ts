import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("Missing Google service account env vars");
  // Env vars stored with literal \n — restore real newlines
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export type SheetRow = {
  sku: string;
  name: string;
  aliases: string | null;
  category: string | null;
  subcategory: string | null;
  kind: "material" | "labor" | "composite";
  unit: string;
  unit_price: number | null;
  labor_rate: number | null;
  labor_unit: string | null;
  min_qty: number | null;
  description: string | null;
  active: boolean;
};

// Columns: sku | name | aliases | category | subcategory | kind | unit |
//          unit_price | labor_rate | labor_unit | min_qty | description | active
const COL = {
  SKU: 0, NAME: 1, ALIASES: 2, CATEGORY: 3, SUBCATEGORY: 4,
  KIND: 5, UNIT: 6, UNIT_PRICE: 7, LABOR_RATE: 8, LABOR_UNIT: 9,
  MIN_QTY: 10, DESCRIPTION: 11, ACTIVE: 12,
} as const;

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === "") return null;
  const n = parseFloat(v.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

function parseBool(v: string | undefined): boolean {
  return (v ?? "").trim().toUpperCase() === "TRUE";
}

function parseKind(v: string | undefined): "material" | "labor" | "composite" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "labor" || s === "composite") return s;
  return "material";
}

export async function readCatalogSheet(): Promise<SheetRow[]> {
  const sheetId = process.env.CATALOG_SHEET_ID;
  const range = process.env.CATALOG_SHEET_RANGE ?? "Catalog!A:M";
  if (!sheetId) throw new Error("CATALOG_SHEET_ID is not set");

  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = res.data.values ?? [];
  const results: SheetRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as string[];
    const sku = (row[COL.SKU] ?? "").toString().trim();
    const name = (row[COL.NAME] ?? "").toString().trim();

    // Skip header row or any row missing sku/name
    if (!sku || !name || sku.toLowerCase() === "sku") continue;

    results.push({
      sku,
      name,
      aliases: row[COL.ALIASES]?.toString().trim() || null,
      category: row[COL.CATEGORY]?.toString().trim() || null,
      subcategory: row[COL.SUBCATEGORY]?.toString().trim() || null,
      kind: parseKind(row[COL.KIND]?.toString()),
      unit: (row[COL.UNIT] ?? "ea").toString().trim(),
      unit_price: parseNum(row[COL.UNIT_PRICE]?.toString()),
      labor_rate: parseNum(row[COL.LABOR_RATE]?.toString()),
      labor_unit: row[COL.LABOR_UNIT]?.toString().trim() || null,
      min_qty: parseNum(row[COL.MIN_QTY]?.toString()),
      description: row[COL.DESCRIPTION]?.toString().trim() || null,
      active: parseBool(row[COL.ACTIVE]?.toString()),
    });
  }

  return results;
}
