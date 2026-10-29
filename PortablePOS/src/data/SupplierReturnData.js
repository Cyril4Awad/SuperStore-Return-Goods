import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { callService } from './ServiceCall';
import { getConnectivity, pingServer } from './Connectivity';
import OfflineStore from './OfflineStore';
import ServerInfo from '../configuration/ServerInfo';

const draftStorageKey = '@superStoreReturnGoods_draft';

const parse = (result) => result === '' ? [] : JSON.parse(result);

// The Wi-Fi is on but the server does not answer : the server may be wrong, so the downloaded data is used
// only once the user chooses Work Offline (until the server answers again). Without Wi-Fi it is used directly
let workOfflineChosen = false;

const SetWorkOffline = (value) => {
    workOfflineChosen = value;
};

// The downloaded data is the data of the saved server (a download made before the server was kept : unknown, accepted)
const IsCatalogOfServer = async () => {
    const [catalogServer, server] = await Promise.all([OfflineStore.getCatalogServer(), ServerInfo.getServer()]);
    return !catalogServer || catalogServer.toLowerCase() === server.toLowerCase();
};

// connectivity : { serverUp, networkUp } (Connectivity), returns it with
// { hasCatalog, catalogOfServer, useOffline } useOffline : the downloaded data is used instead of the server
const OfflineStatusOf = async ({ serverUp, networkUp }) => {
    if (serverUp) workOfflineChosen = false;
    const hasCatalog = await OfflineStore.hasCatalog();
    const catalogOfServer = hasCatalog && (await IsCatalogOfServer());
    return {
        serverUp,
        networkUp,
        hasCatalog,
        catalogOfServer,
        useOffline: !serverUp && catalogOfServer && (!networkUp || workOfflineChosen),
    };
};

const GetOfflineStatus = async () => OfflineStatusOf(await getConnectivity(true));

// Why the app cannot work : no server and the downloaded data cannot be used
const OfflineMessage = ({ networkUp, hasCatalog, catalogOfServer }) =>
    !hasCatalog ? `${networkUp ? 'Cannot Connect To The Server' : 'No Wi-Fi'}.\nDownload Suppliers And Stock While Online To Work Offline.` :
        !catalogOfServer ? 'Cannot Connect To The Server.\nThe Downloaded Data Is From Another Server.' :
            'Cannot Connect To The Server.\nCheck The Server, Or Choose Work Offline.';

const useOfflineData = async () => (await GetOfflineStatus()).useOffline;

const offlineRequired = async () => {
    const status = await GetOfflineStatus();
    if (status.useOffline) return true;
    if (!status.serverUp) throw new Error(OfflineMessage(status));
    return false;
};

// Returns saved on the device go only to the server of their data
const CheckCatalogServer = async (action) => {
    if (await IsCatalogOfServer()) return;
    const catalogServer = await OfflineStore.getCatalogServer();
    throw new Error(`The Returns Saved On The Device Were Made With The Data Of The Server ${catalogServer}.\n${action}`);
};

const GetReturnSetup = async () => {
    if (await useOfflineData()) {
        const setup = await OfflineStore.getCachedSetup();
        if (!setup) throw new Error('Offline Data Is Missing.\nDownload While Online First.');
        return setup;
    }
    try {
        // A short wait : a wrong server is shown quickly, so it can be changed
        return await callService('GetReturnSetup', {}, 10000).then(parse);
    } catch (error) {
        // The setup of the downloaded data is shown only when that data can be used
        if ((await GetOfflineStatus()).useOffline) {
            const setup = await OfflineStore.getCachedSetup();
            if (setup) return setup;
        }
        throw error;
    }
};

const GetSuppliers = async () => {
    if (await useOfflineData()) return OfflineStore.getSuppliers();
    await offlineRequired();
    return callService('GetSuppliers', {}).then(parse);
};

const GetReturnSuppliers = async () => {
    if (await useOfflineData()) {
        const pending = await OfflineStore.getPendingReturns();
        return pending.map(row => ({
            code: row.supplier.code,
            name: row.supplier.name,
            lines: row.lineCount,
            lineCount: row.lineCount,
            totalQty: row.totalQty,
            lastDate: row.savedAt.slice(0, 10),
            savedAt: row.savedAt,
        }));
    }
    await offlineRequired();
    return callService('GetReturnSuppliers', {}).then(parse);
};

const GetSupplierReturns = async (supplierCode, forView = false) => {
    if (await useOfflineData()) {
        const code = supplierCode.trim();
        const pending = await OfflineStore.getPendingReturns();
        const batch = pending.find(row => row.supplier.code === code);
        if (batch) {
            const lines = batch.lines.map((line) => ({
                ...line,
                itemReference: line.itemReference ?? '',
                description: line.description ?? '',
                barcode: line.barcode ?? '',
                date: line.date ?? '',
                basicUnit: line.basicUnit ?? line.unit,
                stock: line.stock ?? [],
            }));
            return { supplier: batch.supplier, lines, pendingId: batch.id };
        }
        const suppliers = await OfflineStore.getSuppliers();
        const supplier = suppliers.find(row => (row.code ?? '').trim() === code);
        if (!supplier) throw new Error('Invalid Supplier');
        return { supplier, lines: [], pendingId: null };
    }
    await offlineRequired();
    return callService('GetSupplierReturns', { supplierCode: supplierCode.trim(), forView: forView }).then(parse);
};

const FindReturnItem = async (code, itemRecID = '') => {
    if (await useOfflineData()) return OfflineStore.findReturnItem(code, itemRecID);
    await offlineRequired();
    return callService('FindReturnItem', { code: code.trim(), itemRecID: itemRecID }).then(parse);
};

// An item of the stock search, sent as an array by the server
const toStockItem = ([itemRecID, itemReference, description, barcode, productGroup, basicUnit]) => ({
    itemRecID,
    itemReference,
    description,
    barcode,
    productGroup,
    basicUnit: basicUnit ?? '',
    searchString: (itemReference + ' ' + barcode + ' ' + description).toUpperCase(),
});

const GetStockSearch = async () => {
    if (await useOfflineData()) return OfflineStore.getStockSearch();
    await offlineRequired();
    return callService('GetStockSearch', {}, 120000).then(result => {
        const stockSearch = parse(result);
        return {
            productGroups: stockSearch.productGroups,
            items: stockSearch.items.map(toStockItem),
        };
    });
};

const GetItemUnits = async (itemRecID) => {
    if (await useOfflineData()) return OfflineStore.getItemUnits(itemRecID);
    await offlineRequired();
    return callService('GetItemUnits', { itemRecID: itemRecID }).then(parse);
};

const GetItemUnit = async (itemRecID, unit) => {
    if (await useOfflineData()) return OfflineStore.getItemUnit(itemRecID, unit);
    await offlineRequired();
    return callService('GetItemUnit', { itemRecID: itemRecID, unit: unit }).then(parse);
};

// Returns { savedOnDevice }
// A return saved on the device (pendingId) stays on the device until it is uploaded, whatever the connection,
// a new return goes to the server when it can be reached, else to the device,
// the returns loaded from the server (Modify / Delete) can only be saved on the server
const SaveSupplierReturns = async (supplierCode, saveMode, lines, options = {}) => {
    const { pendingId = null, supplier = null } = options;

    let onDevice = pendingId !== null;
    if (!onDevice) {
        const status = await GetOfflineStatus();
        if (!status.serverUp) {
            if (saveMode !== 'A') {
                throw new Error('Cannot Reach The Server.\nThese Returns Are On The Server, Save Them When You Are Online.');
            }
            if (!status.useOffline) {
                const error = new Error(OfflineMessage(status));
                // The Wi-Fi is on : the user can still choose to save on the device
                error.canWorkOffline = status.catalogOfServer;
                throw error;
            }
            onDevice = true;
        }
    }

    if (onDevice) {
        if (saveMode === 'D') {
            if (!pendingId) throw new Error('Invalid Pending Return');
            await OfflineStore.deletePendingReturn(pendingId);
        } else {
            if (!supplier) throw new Error('Invalid Supplier');
            if (pendingId) await OfflineStore.updatePendingReturn(pendingId, supplier, lines);
            else await OfflineStore.insertPendingReturn(supplier, lines);
        }
        return { savedOnDevice: true };
    }

    await callService('SaveSupplierReturns', {
        userCode: '',
        supplierCode: supplierCode,
        saveMode: saveMode,
        lines: JSON.stringify(lines.map(line => ({
            itemRecID: line.itemRecID,
            counter: line.counter ?? 0,
            unit: line.unit,
            qtyReturn: Number(line.qtyReturn) || 0,
            oldQtyReturn: Number(line.oldQtyReturn) || 0,
            warehouse: line.warehouse,
            remarks: line.remarks ?? '',
            state: line.state ?? '',
        }))),
    }, 120000);
    return { savedOnDevice: false };
};

// The download and the upload go by pages of this number of records
export const OFFLINE_PAGE_SIZE = 5000;

// Cancel of a download / upload : token.cancel() stops the waiting at once (the error has cancelled = true),
// it returns false once the token is locked (the last step, that saves everything at once, has started)
export const CreateCancelToken = () => {
    let reject;
    const promise = new Promise((_, rejectCancel) => { reject = rejectCancel; });
    promise.catch(() => { });
    const token = {
        isCancelled: false,
        isLocked: false,
        promise,
        lock: () => { token.isLocked = true; },
        cancel: () => {
            if (token.isCancelled || token.isLocked) return false;
            token.isCancelled = true;
            const error = new Error('Cancelled');
            error.cancelled = true;
            reject(error);
            return true;
        },
    };
    return token;
};

// Waits for the promise, or rejects as soon as the token is cancelled (the promise is then not waited for),
// also when the promise ends at the time of the cancel
const untilCancelled = async (token, promise) => {
    if (!token) return promise;
    promise.catch(() => { });
    const result = await Promise.race([token.promise, promise]);
    if (token.isCancelled) return token.promise;
    return result;
};

// Asks the pages one after the other : fetchPage(the last row of the previous page, null for the first page),
// the next page is asked while the current one is saved on the device
const DownloadPages = async (token, fetchPage, savePage) => {
    let next = fetchPage(null);
    for (; ;) {
        const rows = await untilCancelled(token, next);
        if (rows.length === 0) return;
        const isLastPage = rows.length < OFFLINE_PAGE_SIZE;
        next = isLastPage ? null : fetchPage(rows[rows.length - 1]);
        // When the save fails, the page asked meanwhile is not waited for
        next?.catch(() => { });
        await untilCancelled(token, savePage(rows));
        if (isLastPage) return;
    }
};

// All or nothing : the pages go to copies of the tables, that replace the tables of the last download in one
// transaction once every page is there. Failed or cancelled (token), the copies are removed and the last download stays
// onProgress({ bars: [{ title, current, total }], step, cancellable }) : a bar for the suppliers, the items and the qty
// in warehouses (total 0 : not known yet)
const DownloadOfflineCatalog = async (onProgress, token = null) => {
    const online = await pingServer();
    if (!online) throw new Error('Cannot Reach The Server.\nConnect To Wi-Fi To Download Offline Data.');

    // A download from another server would make the returns saved on the device go to that server
    if ((await OfflineStore.countPendingReturns()) > 0) {
        await CheckCatalogServer('Upload Them To That Server Before Downloading From This One.');
    }
    const server = await ServerInfo.getServer();

    const bars = {
        suppliers: { title: 'Suppliers', current: 0, total: 0 },
        items: { title: 'Items', current: 0, total: 0 },
        stock: { title: 'Qty In Warehouses', current: 0, total: 0 },
    };
    const report = (step, cancellable = true) => {
        if (token?.isCancelled) return;
        onProgress?.({
            bars: [bars.suppliers, bars.items, bars.stock].map(bar => ({ ...bar, total: Math.max(bar.total, bar.current) })),
            step,
            cancellable,
        });
    };

    report('Preparing The Download');
    const countsCall = callService('GetOfflineCounts', {}, 300000).then(parse);
    // The totals are shown as soon as they are known
    countsCall.then(counts => {
        bars.suppliers.total = Number(counts.suppliers) || 0;
        bars.items.total = Number(counts.items) || 0;
        bars.stock.total = Number(counts.stockRows) || 0;
        report('Preparing The Download');
    }).catch(() => { });
    const [setup, suppliers, counts] = await untilCancelled(token, Promise.all([
        callService('GetReturnSetup', {}).then(parse),
        callService('GetSuppliers', {}).then(parse),
        countsCall,
    ]));
    bars.suppliers.current = suppliers.length;
    bars.suppliers.total = suppliers.length;

    try {
        await untilCancelled(token, OfflineStore.beginCatalogDownload());
        report('Downloading');

        await DownloadPages(token,
            (lastRow) => callService('GetOfflineItemsPage', {
                afterRecID: lastRow ? lastRow[0] : '',
                pageSize: OFFLINE_PAGE_SIZE,
            }, 120000).then(parse),
            async (rows) => {
                await OfflineStore.saveStockItemsPage(rows.map(toStockItem));
                bars.items.current += rows.length;
                report('Downloading');
            },
        );
        // The items are all there, even if their number changed since the count
        bars.items.total = bars.items.current;
        report('Downloading');

        await DownloadPages(token,
            (lastRow) => callService('GetOfflineStockPage', {
                afterRecID: lastRow ? lastRow[0] : '',
                afterUnit: lastRow ? lastRow[1] : '',
                afterWarehouse: lastRow ? lastRow[2] : '',
                pageSize: OFFLINE_PAGE_SIZE,
            }, 120000).then(parse),
            async (rows) => {
                await OfflineStore.saveWarehouseStockPage(rows.map(([itemRecID, unit, warehouse, qty, display]) =>
                    ({ itemRecID, unit, warehouse, qty, display })));
                bars.stock.current += rows.length;
                report('Downloading');
            },
        );
        bars.stock.total = bars.stock.current;

        // From here the download is not cancelled anymore : the tables are replaced in one transaction
        await untilCancelled(token, Promise.resolve());
        token?.lock();
        report('Saving On The Device', false);
        await OfflineStore.finishCatalogDownload({ setup, suppliers, productGroups: counts.productGroups ?? [], server });
    } catch (error) {
        await OfflineStore.discardCatalogDownload().catch(() => { });
        throw error;
    }

    return {
        setup,
        supplierCount: suppliers.length,
        itemCount: bars.items.current,
        stockRowCount: bars.stock.current,
    };
};

// Uploads every return saved on the device, all or nothing : the lines (each with its supplier) go by pages of
// OFFLINE_PAGE_SIZE to the server (UploadReturnPage), then CommitReturnUpload saves all of them in one transaction.
// The returns stay on the device until the commit is done. Failed or cancelled (token) before the commit, the server
// removes the pages (CancelReturnUpload) and nothing is saved.
// The same saved returns are always the same uploadId : the server never saves them twice
// onProgress({ bars: [{ title, current, total }], step, cancellable }), returns { returns, records }
const UploadAllPendingReturns = async (onProgress, token = null) => {
    const online = await pingServer();
    if (!online) throw new Error('Cannot Reach The Server.\nConnect To Wi-Fi To Upload.');
    await CheckCatalogServer('Change The Server Back To That Server To Upload Them.');

    const pending = (await OfflineStore.getPendingReturns()).sort((left, right) => left.id - right.id);
    if (pending.length === 0) throw new Error('No Saved Returns To Upload.');

    // A return changed since (savedAt) or another set of returns is another upload
    const uploadId = `${DeviceInfo.getUniqueIdSync()}|${pending.map(row => `${row.id}@${row.savedAt}`).join(',')}`;
    const lines = pending.flatMap(row => row.lines.map(line => ({
        supplierCode: row.supplier.code,
        itemRecID: line.itemRecID,
        counter: 0,
        unit: line.unit,
        qtyReturn: Number(line.qtyReturn) || 0,
        oldQtyReturn: 0,
        warehouse: line.warehouse,
        remarks: line.remarks ?? '',
        state: 'A',
    })));
    const total = lines.length;
    const pageCount = Math.ceil(total / OFFLINE_PAGE_SIZE);
    const report = (step, current, cancellable = true) => {
        if (!token?.isCancelled) onProgress?.({ bars: [{ title: 'Records', current, total }], step, cancellable });
    };

    try {
        report('Sending The Records', 0);
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            const page = lines.slice(pageIndex * OFFLINE_PAGE_SIZE, (pageIndex + 1) * OFFLINE_PAGE_SIZE);
            await untilCancelled(token, callService('UploadReturnPage', {
                uploadId,
                pageIndex,
                lines: JSON.stringify(page),
            }, 120000));
            report('Sending The Records', pageIndex * OFFLINE_PAGE_SIZE + page.length);
        }
        await untilCancelled(token, Promise.resolve());
        token?.lock();
    } catch (error) {
        callService('CancelReturnUpload', { uploadId }, 15000).catch(() => { });
        throw error;
    }

    // From here the upload is not cancelled anymore : the server saves all the lines in one transaction
    report('Saving On The Server', total, false);
    await callService('CommitReturnUpload', { uploadId, pageCount, lineCount: total }, 300000);

    await OfflineStore.deletePendingReturns(pending.map(row => row.id));
    return { returns: pending.length, records: total };
};

const SaveDraft = (draft) => AsyncStorage.setItem(draftStorageKey, JSON.stringify(draft)).catch(() => { });

const ReadDraft = () => AsyncStorage.getItem(draftStorageKey)
    .then(text => text ? JSON.parse(text) : null)
    .catch(() => null);

const ClearDraft = () => AsyncStorage.removeItem(draftStorageKey).catch(() => { });

export default {
    GetReturnSetup,
    GetSuppliers,
    GetReturnSuppliers,
    GetSupplierReturns,
    FindReturnItem,
    GetStockSearch,
    GetItemUnits,
    GetItemUnit,
    SaveSupplierReturns,
    CreateCancelToken,
    DownloadOfflineCatalog,
    UploadAllPendingReturns,
    SaveDraft,
    ReadDraft,
    ClearDraft,
    pingServer,
    SetWorkOffline,
    OfflineStatusOf,
    GetOfflineStatus,
    OfflineMessage,
};
