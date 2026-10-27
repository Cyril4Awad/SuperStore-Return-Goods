import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

const DB_NAME = 'SuperStoreReturnGoods.db';
let dbPromise = null;

const openDb = () => {
    if (!dbPromise) {
        dbPromise = SQLite.openDatabase({ name: DB_NAME, location: 'default' });
    }
    return dbPromise;
};

const execSql = async (sql, params = []) => {
    const db = await openDb();
    const [result] = await db.executeSql(sql, params);
    return result;
};

const rowsFromResult = (result) => {
    const rows = [];
    for (let i = 0; i < result.rows.length; i += 1) {
        rows.push(result.rows.item(i));
    }
    return rows;
};

// The columns of the downloaded tables, the download fills copies of them (*_dl) that replace them once complete
const STOCK_ITEMS_COLUMNS = `
        itemRecID TEXT PRIMARY KEY NOT NULL,
        itemReference TEXT NOT NULL,
        description TEXT,
        barcode TEXT,
        productGroup TEXT,
        basicUnit TEXT,
        searchString TEXT`;
const STOCK_ITEMS_INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_stock_ref ON stock_items(itemReference)',
    'CREATE INDEX IF NOT EXISTS idx_stock_barcode ON stock_items(barcode)',
];
const WAREHOUSE_STOCK_COLUMNS = `
        itemRecID TEXT NOT NULL,
        unit TEXT NOT NULL,
        warehouse TEXT NOT NULL,
        qty REAL NOT NULL,
        display TEXT,
        PRIMARY KEY (itemRecID, unit, warehouse)`;
const WAREHOUSE_STOCK_INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_item_stock ON item_warehouse_stock(itemRecID, unit)',
];

const initSchema = async () => {
    await execSql(`CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
    )`);
    await execSql(`CREATE TABLE IF NOT EXISTS suppliers (
        code TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL
    )`);
    await execSql(`CREATE TABLE IF NOT EXISTS stock_items (${STOCK_ITEMS_COLUMNS})`);
    for (const sql of STOCK_ITEMS_INDEXES) await execSql(sql);
    await execSql(`CREATE TABLE IF NOT EXISTS product_groups (
        code TEXT PRIMARY KEY NOT NULL,
        description TEXT,
        items INTEGER
    )`);
    await execSql(`CREATE TABLE IF NOT EXISTS pending_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_code TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        lines_json TEXT NOT NULL,
        saved_at TEXT NOT NULL
    )`);
    await execSql(`CREATE TABLE IF NOT EXISTS item_warehouse_stock (${WAREHOUSE_STOCK_COLUMNS})`);
    for (const sql of WAREHOUSE_STOCK_INDEXES) await execSql(sql);
};

let schemaReady = null;
const ensureSchema = () => {
    if (!schemaReady) schemaReady = initSchema();
    return schemaReady;
};

const getMeta = async (key) => {
    await ensureSchema();
    const result = await execSql('SELECT value FROM meta WHERE key = ?', [key]);
    if (result.rows.length === 0) return null;
    return result.rows.item(0).value;
};

export const hasCatalog = async () => {
    const flag = await getMeta('catalogReady');
    return flag === '1';
};

export const getCachedSetup = async () => {
    const text = await getMeta('setup');
    return text ? JSON.parse(text) : null;
};

const getItemStockRows = async (itemRecID, unit) => {
    await ensureSchema();
    const result = await execSql(
        'SELECT warehouse, qty, display FROM item_warehouse_stock WHERE itemRecID = ? AND unit = ? ORDER BY warehouse',
        [itemRecID, unit],
    );
    return rowsFromResult(result).map(row => ({
        warehouse: row.warehouse,
        qty: row.qty,
        display: row.display ?? '',
    }));
};

export const getDownloadedAt = async () => getMeta('downloadedAt');

// SQLite of Android takes 999 parameters at most in one statement
const MAX_SQL_PARAMS = 999;

// Multi-row INSERT OR REPLACE statements for sqlBatch : one statement per MAX_SQL_PARAMS values
// (a row sent twice by the server replaces the first one instead of failing the download)
const insertStatements = (table, columns, rows, rowValues) => {
    const rowsPerStatement = Math.floor(MAX_SQL_PARAMS / columns.length);
    const placeholders = `(${columns.map(() => '?').join(', ')})`;
    const statements = [];
    for (let index = 0; index < rows.length; index += rowsPerStatement) {
        const chunk = rows.slice(index, index + rowsPerStatement);
        const params = [];
        for (const row of chunk) params.push(...rowValues(row));
        statements.push([
            `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES ${chunk.map(() => placeholders).join(', ')}`,
            params,
        ]);
    }
    return statements;
};

// sqlBatch runs every statement in one transaction (db.transaction with awaits inside commits after the first statement)
const runBatch = async (statements) => {
    if (statements.length === 0) return;
    const db = await openDb();
    await db.sqlBatch(statements);
};

const STOCK_ITEM_FIELDS = ['itemRecID', 'itemReference', 'description', 'barcode', 'productGroup', 'basicUnit', 'searchString'];
const WAREHOUSE_STOCK_FIELDS = ['itemRecID', 'unit', 'warehouse', 'qty', 'display'];

// The download : beginCatalogDownload, the pages (saveStockItemsPage, saveWarehouseStockPage), then finishCatalogDownload
// The data of the last download stays in use until finishCatalogDownload replaces it in one transaction,
// a download that fails keeps it
export const beginCatalogDownload = async () => {
    await ensureSchema();
    await runBatch([
        'DROP TABLE IF EXISTS stock_items_dl',
        'DROP TABLE IF EXISTS item_warehouse_stock_dl',
        `CREATE TABLE stock_items_dl (${STOCK_ITEMS_COLUMNS})`,
        `CREATE TABLE item_warehouse_stock_dl (${WAREHOUSE_STOCK_COLUMNS})`,
    ]);
};

// A download cancelled or failed : its tables are removed, the data of the last download stays in use
export const discardCatalogDownload = () => runBatch([
    'DROP TABLE IF EXISTS stock_items_dl',
    'DROP TABLE IF EXISTS item_warehouse_stock_dl',
]);

// items : [{ itemRecID, itemReference, description, barcode, productGroup, basicUnit, searchString }]
export const saveStockItemsPage = (items) => runBatch(insertStatements('stock_items_dl', STOCK_ITEM_FIELDS, items, item => [
    item.itemRecID,
    item.itemReference,
    item.description,
    item.barcode,
    item.productGroup,
    item.basicUnit ?? '',
    item.searchString,
]));

// rows : [{ itemRecID, unit, warehouse, qty, display }]
export const saveWarehouseStockPage = (rows) => runBatch(insertStatements('item_warehouse_stock_dl', WAREHOUSE_STOCK_FIELDS, rows, row => [
    row.itemRecID,
    row.unit,
    row.warehouse,
    Number(row.qty) || 0,
    row.display ?? '',
]));

export const finishCatalogDownload = ({ setup, suppliers, productGroups }) => runBatch([
    'DROP TABLE IF EXISTS stock_items',
    'ALTER TABLE stock_items_dl RENAME TO stock_items',
    ...STOCK_ITEMS_INDEXES,
    'DROP TABLE IF EXISTS item_warehouse_stock',
    'ALTER TABLE item_warehouse_stock_dl RENAME TO item_warehouse_stock',
    ...WAREHOUSE_STOCK_INDEXES,
    'DELETE FROM suppliers',
    ...insertStatements('suppliers', ['code', 'name'], suppliers, supplier => [supplier.code, supplier.name ?? '']),
    'DELETE FROM product_groups',
    ...insertStatements('product_groups', ['code', 'description', 'items'], productGroups,
        group => [group.code, group.description, group.items ?? 0]),
    ['INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['setup', JSON.stringify(setup)]],
    ['INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['catalogReady', '1']],
    ['INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', ['downloadedAt', new Date().toISOString()]],
]);

export const getSuppliers = async () => {
    await ensureSchema();
    const result = await execSql('SELECT code, name FROM suppliers ORDER BY code');
    return rowsFromResult(result);
};

export const getStockSearch = async () => {
    await ensureSchema();
    const groupsResult = await execSql('SELECT code, description, items FROM product_groups ORDER BY description');
    const itemsResult = await execSql(
        `SELECT itemRecID, itemReference, description, barcode, productGroup, basicUnit, searchString
         FROM stock_items ORDER BY itemReference`,
    );
    const items = rowsFromResult(itemsResult);
    return {
        productGroups: rowsFromResult(groupsResult),
        items,
    };
};

const todayDisplay = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const findReturnItem = async (code, itemRecID = '') => {
    await ensureSchema();
    const trimmed = (code ?? '').trim();
    let result;
    if (itemRecID) {
        result = await execSql('SELECT * FROM stock_items WHERE itemRecID = ?', [itemRecID]);
    } else {
        result = await execSql(
            `SELECT * FROM stock_items
             WHERE itemReference = ? OR (barcode <> '' AND barcode = ?)`,
            [trimmed, trimmed],
        );
    }
    const rows = rowsFromResult(result);
    if (rows.length === 0) {
        throw new Error(`No Active Item Found For The Code ${trimmed}`);
    }
    const distinct = [...new Map(rows.map(row => [row.itemRecID, row])).values()];
    if (distinct.length > 1 && !itemRecID) {
        return {
            matches: distinct.map(row => ({
                itemRecID: row.itemRecID,
                itemReference: row.itemReference,
                description: row.description,
            })),
        };
    }
    const row = distinct[0];
    const unit = row.basicUnit || '';
    const stock = unit ? await getItemStockRows(row.itemRecID, unit) : [];
    return {
        item: {
            itemRecID: row.itemRecID,
            itemReference: row.itemReference,
            description: row.description,
            barcode: row.barcode,
            unit,
            basicUnit: unit,
            packingBasic: 1,
            date: todayDisplay(),
            stock,
        },
    };
};

export const getItemUnits = async (itemRecID) => {
    await ensureSchema();
    const result = await execSql(
        'SELECT DISTINCT unit FROM item_warehouse_stock WHERE itemRecID = ? ORDER BY unit',
        [itemRecID],
    );
    const units = rowsFromResult(result).map(row => row.unit).filter(Boolean);
    if (units.length > 0) {
        return units.map(unit => ({ code: unit, description: unit }));
    }
    const item = await findReturnItem('', itemRecID);
    const fallback = item.item.unit;
    return fallback ? [{ code: fallback, description: fallback }] : [];
};

export const getItemUnit = async (itemRecID, unit) => {
    const result = await findReturnItem('', itemRecID);
    const chosenUnit = unit || result.item.unit;
    const stock = chosenUnit ? await getItemStockRows(itemRecID, chosenUnit) : [];
    return {
        unit: chosenUnit,
        barcode: result.item.barcode,
        stock,
    };
};

export const insertPendingReturn = async (supplier, lines) => {
    await ensureSchema();
    const payload = lines
        .filter(line => line.state !== 'D')
        .map(line => ({
            itemRecID: line.itemRecID,
            counter: line.counter ?? 0,
            itemReference: line.itemReference ?? '',
            unit: line.unit,
            description: line.description ?? '',
            barcode: line.barcode ?? '',
            date: line.date ?? '',
            basicUnit: line.basicUnit ?? line.unit,
            qtyReturn: Number(line.qtyReturn) || 0,
            oldQtyReturn: 0,
            warehouse: line.warehouse,
            remarks: line.remarks ?? '',
            state: 'A',
        }));
    await execSql(
        'INSERT INTO pending_returns (supplier_code, supplier_name, lines_json, saved_at) VALUES (?, ?, ?, ?)',
        [supplier.code, supplier.name, JSON.stringify(payload), new Date().toISOString()],
    );
};

export const updatePendingReturn = async (id, supplier, lines) => {
    await ensureSchema();
    const payload = lines
        .filter(line => line.state !== 'D')
        .map(line => ({
            itemRecID: line.itemRecID,
            counter: line.counter ?? 0,
            itemReference: line.itemReference ?? '',
            unit: line.unit,
            description: line.description ?? '',
            barcode: line.barcode ?? '',
            date: line.date ?? '',
            basicUnit: line.basicUnit ?? line.unit,
            qtyReturn: Number(line.qtyReturn) || 0,
            oldQtyReturn: 0,
            warehouse: line.warehouse,
            remarks: line.remarks ?? '',
            state: 'A',
        }));
    await execSql(
        'UPDATE pending_returns SET supplier_code = ?, supplier_name = ?, lines_json = ?, saved_at = ? WHERE id = ?',
        [supplier.code, supplier.name, JSON.stringify(payload), new Date().toISOString(), id],
    );
};

export const deletePendingReturn = async (id) => {
    await ensureSchema();
    await execSql('DELETE FROM pending_returns WHERE id = ?', [id]);
};

// The returns uploaded, in one statement
export const deletePendingReturns = async (ids) => {
    await ensureSchema();
    if (ids.length === 0) return;
    await execSql(`DELETE FROM pending_returns WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
};

export const getPendingReturns = async () => {
    await ensureSchema();
    const result = await execSql(
        'SELECT id, supplier_code, supplier_name, lines_json, saved_at FROM pending_returns ORDER BY saved_at DESC',
    );
    return rowsFromResult(result).map(row => {
        const lines = JSON.parse(row.lines_json);
        const totalQty = lines.reduce((sum, line) => sum + (Number(line.qtyReturn) || 0), 0);
        return {
            id: row.id,
            supplier: { code: row.supplier_code, name: row.supplier_name },
            lines,
            savedAt: row.saved_at,
            lineCount: lines.length,
            totalQty,
        };
    });
};

export const getPendingReturn = async (id) => {
    const all = await getPendingReturns();
    return all.find(row => row.id === id) ?? null;
};

export const countPendingReturns = async () => {
    await ensureSchema();
    const result = await execSql('SELECT COUNT(*) AS cnt FROM pending_returns');
    return result.rows.item(0).cnt;
};

export default {
    hasCatalog,
    getCachedSetup,
    getDownloadedAt,
    beginCatalogDownload,
    discardCatalogDownload,
    saveStockItemsPage,
    saveWarehouseStockPage,
    finishCatalogDownload,
    getSuppliers,
    getStockSearch,
    findReturnItem,
    getItemUnits,
    getItemUnit,
    insertPendingReturn,
    updatePendingReturn,
    deletePendingReturn,
    deletePendingReturns,
    getPendingReturns,
    getPendingReturn,
    countPendingReturns,
};
