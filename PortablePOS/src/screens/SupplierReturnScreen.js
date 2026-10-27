import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Pressable, Keyboard, Image, FlatList, BackHandler, Modal } from 'react-native';
import Colors from '../variables/Colors';
import Sizing from '../variables/Sizing';
import { FontSize } from '../variables/ResponsiveFont';
import ChoiceField, { choiceRowStyle } from '../components/controls/ChoiceField';
import MainButton from '../components/controls/MainButton';
import LoadingData from '../components/LoadingData';
import MessageBox from '../components/MessageBox';
import FilterList, { FilterRows } from '../components/lists/supplierReturn/FilterList';
import StockSearch from '../components/lists/supplierReturn/StockSearch';
import ReturnLineEditor from '../components/lists/supplierReturn/ReturnLineEditor';
import SupplierReturnData from '../data/SupplierReturnData';
import OfflineStore from '../data/OfflineStore';
import { subscribeConnectivity, getConnectivity } from '../data/Connectivity';
import ServerInfo from '../configuration/ServerInfo';
import { setServiceLocation } from '../data/ServiceCall';
import ModalTitle from '../components/ModalTitle';
import { PlayScanOk, PlayScanError } from '../variables/ScanSounds';
import ProgressBox from '../components/ProgressBox';

// How long the notice of an action stays shown
const NOTICE_MS = 3500;

const MODE_NAMES = { '': 'Supplier Returns', V: 'View', A: 'Add', M: 'Modify', D: 'Delete' };

const formatReturnsRecords = (returnCount, recordCount) =>
  `${returnCount} Return${returnCount === 1 ? '' : 's'} With A Total Of ${recordCount} Record${recordCount === 1 ? '' : 's'}`;

const formatDownloadDateTime = (isoText) => {
  if (!isoText) return '';
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

let lineKey = 0;
const newLineKey = () => String(++lineKey);

// Supplier Return Qty (FrmSupplierReturnQty of SuperStore) : the quantities to return to a supplier, per item, unit and warehouse
// View   : choose a supplier having returns, its returns are shown (the box filters them), a line shows its details
// Add    : choose the supplier, scan (keyboard wedge : the scanner types the code then Enter) or search the items (stock search),
//          the lines added can be changed (unit, quantity, warehouse, remarks) until they are saved
// Modify : choose the supplier, its returns are loaded, change the quantities / remarks or delete lines, then save
// Delete : choose the supplier, its returns are loaded, save deletes all of them
// The return in progress is kept on the device (draft) and offered again when the app is opened before it was saved / cancelled
const SupplierReturnScreen = () => {

  // { warehouses: [{ code, description }], defaultWarehouse, qtyDecimals, location, userCode }
  const [setup, setSetup] = useState(null);

  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [serverDraft, setServerDraft] = useState('');
  const infoTapCount = useRef(0);
  const infoTapTimer = useRef(null);

  const [mode, setMode] = useState('');
  // { code, name }
  const [supplier, setSupplier] = useState(null);
  // [{ key, itemRecID, counter, itemReference, unit, description, barcode, date, basicUnit, qtyReturn, oldQtyReturn,
  //    warehouse, remarks, stock, state }] state : '' loaded, A new, M changed, D deleted (Modify)
  const [lines, setLines] = useState([]);
  const [linesFilter, setLinesFilter] = useState('');
  // Modify : the lines as they were loaded (Clear brings them back)
  const [loadedLines, setLoadedLines] = useState([]);

  // The line in the row editor : { line, isNewLine }
  const [editor, setEditor] = useState(null);

  // The lists loaded from the server : { rows, loading, error }
  const [suppliers, setSuppliers] = useState({ rows: null, loading: false, error: '' });
  const [returnSuppliers, setReturnSuppliers] = useState({ rows: null, loading: false, error: '' });
  const [stockSearch, setStockSearch] = useState({ rows: null, loading: false, error: '' });

  // The list open : 'supplier' | 'stock' | 'matches'
  const [picker, setPicker] = useState('');
  // The items of a scanned code used by more than one item
  const [matches, setMatches] = useState([]);

  const [scanner, setScanner] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  // The notice of the last action (item added, changed...), hidden after NOTICE_MS
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);

  const [isOnline, setIsOnline] = useState(false);
  const [hasOfflineCatalog, setHasOfflineCatalog] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRecordCount, setPendingRecordCount] = useState(0);
  const [lastDownloadAt, setLastDownloadAt] = useState('');
  const [pendingReturnId, setPendingReturnId] = useState(null);
  const [uploadPickerVisible, setUploadPickerVisible] = useState(false);
  const [uploadReview, setUploadReview] = useState(null);
  const [pendingUploadRows, setPendingUploadRows] = useState([]);

  const scannerInputControl = useRef();
  // The draft is saved after the one of the last time was restored or discarded only
  const draftReady = useRef(false);

  const activeLines = lines.filter(line => line.state !== 'D');
  const shownLines = FilterRows(activeLines, linesFilter,
    line => `${line.itemReference} ${line.barcode} ${line.description} ${line.unit} ${line.remarks}`.toUpperCase());
  const qtyDecimals = setup?.qtyDecimals ?? 2;
  // Something to save : Add has lines, Modify has a line deleted or changed from the way it was loaded (loadKey),
  // View and Delete change nothing. Without changes : no draft, no question when leaving, nothing to save
  const ChangedFromLoaded = (line) => {
    if (line.state === 'D') return true;
    if (line.state !== 'M') return false;
    const loaded = loadedLines.find(loadedLine => loadedLine.loadKey !== undefined && loadedLine.loadKey === line.loadKey);
    return !loaded
      || Number(loaded.qtyReturn).toFixed(qtyDecimals) !== Number(line.qtyReturn).toFixed(qtyDecimals)
      || (loaded.remarks ?? '').trim() !== (line.remarks ?? '').trim();
  };
  const hasChanges = mode === 'A' ? lines.length > 0 :
    mode === 'M' ? lines.some(ChangedFromLoaded) : false;

  const RefreshOfflineState = () => Promise.all([
    OfflineStore.hasCatalog(),
    OfflineStore.getPendingReturns(),
    OfflineStore.getDownloadedAt(),
  ]).then(([catalog, pending, downloadedAt]) => {
    setHasOfflineCatalog(catalog);
    setPendingCount(pending.length);
    setPendingRecordCount(pending.reduce((sum, row) => sum + row.lineCount, 0));
    setLastDownloadAt(downloadedAt ?? '');
  });

  useEffect(() => {
    LoadSetup();
    RefreshOfflineState();
    return subscribeConnectivity(({ serverUp }) => setIsOnline(serverUp));
  }, []);

  // The draft follows every change of the return
  useEffect(() => {
    if (!draftReady.current) return;
    if (hasChanges) SupplierReturnData.SaveDraft({ mode, supplier, lines, loadedLines, pendingReturnId });
    else SupplierReturnData.ClearDraft();
  }, [mode, supplier, lines, loadedLines, pendingReturnId]);

  // Back key of the device : the buttons leave the app, a mode goes back to the buttons (asks first when there are changes)
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === '') return false;
      if (!hasChanges) {
        ResetForm();
        return true;
      }
      MessageBox.alert('SuperStore Return Goods', 'Do You Want To Discard Changes ?', [
        { text: 'No', style: 'cancel', onPress: focusScanner },
        {
          text: 'Yes', style: 'destructive', onPress: () => {
            SupplierReturnData.ClearDraft();
            ResetForm();
          }
        },
      ]);
      return true;
    });
    return () => subscription.remove();
  }, [hasChanges, mode]);

  const focusScanner = () => {
    setTimeout(() => scannerInputControl.current?.focus(), 100);
  };

  // Errors : the message box of the app, the scanner gets the focus back when it is closed
  const ShowError = (message, title = 'Error') => {
    PlayScanError();
    MessageBox.alert(title, message, [{ text: 'OK', onPress: focusScanner }]);
  };

  const ShowNotice = (text) => {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    clearTimeout(infoTapTimer.current);
  }, []);

  const OnInfoPress = () => {
    clearTimeout(infoTapTimer.current);
    infoTapCount.current += 1;
    if (infoTapCount.current >= 7) {
      infoTapCount.current = 0;
      ServerInfo.getServer().then(server => {
        setServerDraft(server);
        setServerModalVisible(true);
      });
      return;
    }
    infoTapTimer.current = setTimeout(() => {
      infoTapCount.current = 0;
    }, 3500);
  };

  const SaveServer = () => {
    ServerInfo.setServer(serverDraft).then(() => {
      setServerModalVisible(false);
      LoadSetup();
    });
  };

  const DownloadOfflineCatalog = () => {
    if (!isOnline) {
      ShowError('Connect To The Server To Download Offline Data.', 'Download');
      return;
    }
    setIsBusy(true);
    const started = Date.now();
    const token = SupplierReturnData.CreateCancelToken();
    let shownBars = ['Suppliers', 'Items', 'Qty In Warehouses'].map(title => ({ title, current: 0, total: 0 }));
    const cancel = () => {
      if (token.cancel()) ProgressBox.show('Downloading', shownBars, 'Cancelling...');
    };
    ProgressBox.show('Downloading', shownBars, 'Connecting To The Server', cancel);
    SupplierReturnData.DownloadOfflineCatalog(({ bars, step, cancellable }) => {
      shownBars = bars;
      ProgressBox.show('Downloading', bars, step, cancellable ? cancel : null);
    }, token)
      .then(({ setup: returnSetup, supplierCount, itemCount, stockRowCount }) => {
        setSetup(returnSetup);
        setServiceLocation(returnSetup.location);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        // The notice is shown in the modes only, the home screen gets the message box
        MessageBox.alert('Download',
          `Downloaded ${supplierCount} Suppliers, ${itemCount} Items And ${stockRowCount} Qty In Warehouses.\nWorked for ${seconds}s`);
      })
      .catch(error => {
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (error.cancelled) {
          MessageBox.alert('Download', `Download Cancelled, Nothing Was Changed On The Device.\nWorked for ${seconds}s`);
        } else {
          ShowError(`${error.message}\nNothing Was Changed On The Device.`, 'Download');
        }
      })
      .finally(() => {
        ProgressBox.hide();
        setIsBusy(false);
        RefreshOfflineState();
      });
  };

  const OpenUploadPicker = () => {
    if (!isOnline) {
      ShowError('Connect To The Server To Upload Saved Returns.', 'Upload');
      return;
    }
    setIsBusy(true);
    OfflineStore.getPendingReturns()
      .then(rows => {
        if (rows.length === 0) {
          ShowError('No Saved Returns To Upload.', 'Upload');
          RefreshOfflineState();
          return;
        }
        setPendingUploadRows(rows);
        setUploadPickerVisible(true);
      })
      .catch(error => ShowError(error.message, 'Upload'))
      .finally(() => setIsBusy(false));
  };

  // A saved return is shown read-only, the upload sends all of them (Upload of the list)
  const OpenUploadReview = (batch) => {
    setUploadReview(batch);
  };

  const UploadAll = () => {
    setIsBusy(true);
    const started = Date.now();
    const token = SupplierReturnData.CreateCancelToken();
    let shownBars = [{ title: 'Records', current: 0, total: pendingRecordCount }];
    const cancel = () => {
      if (token.cancel()) ProgressBox.show('Uploading', shownBars, 'Cancelling...');
    };
    ProgressBox.show('Uploading', shownBars, 'Connecting To The Server', cancel);
    SupplierReturnData.UploadAllPendingReturns(({ bars, step, cancellable }) => {
      shownBars = bars;
      ProgressBox.show('Uploading', bars, step, cancellable ? cancel : null);
    }, token)
      .then(({ returns, records }) => {
        setUploadPickerVisible(false);
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        MessageBox.alert('Upload', `Uploaded Successfully.\n${formatReturnsRecords(returns, records)}.\nWorked for ${seconds}s`);
      })
      .catch(error => {
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        if (error.cancelled) {
          MessageBox.alert('Upload', `Upload Cancelled, Nothing Was Saved On The Server.\nThe Returns Are Still On The Device.\nWorked for ${seconds}s`);
        } else {
          ShowError(`${error.message}\nNothing Was Saved On The Server, The Returns Are Still On The Device.`, 'Upload');
        }
      })
      .finally(() => {
        ProgressBox.hide();
        setIsBusy(false);
        RefreshOfflineState();
      });
  };

  const LoadSetup = () => {

    setIsBusy(true);

    SupplierReturnData.GetReturnSetup()
      .then(returnSetup => {
        setSetup(returnSetup);
        setServiceLocation(returnSetup.location);
        return SupplierReturnData.ReadDraft();
      })
      .then(draft => {
        // A draft without lines has nothing to restore
        if (draft && (draft.lines ?? []).length > 0) {
          OfferDraft(draft);
        } else {
          draftReady.current = true;
        }
      })
      .catch(error => {
        OfflineStore.hasCatalog().then(hasCatalog => {
          if (hasCatalog) {
            return OfflineStore.getCachedSetup().then(cachedSetup => {
              if (cachedSetup) {
                setSetup(cachedSetup);
                setServiceLocation(cachedSetup.location);
                draftReady.current = true;
                return;
              }
              throw error;
            });
          }
          throw error;
        }).catch(() => {
          ServerInfo.getServer().then(server => {
            MessageBox.alert('Cannot Connect', `${error.message}

Server : ${server}`, [{ text: 'Retry', onPress: LoadSetup }]);
          });
        });
      })
      .finally(() => {
        setIsBusy(false);
        RefreshOfflineState();
        getConnectivity(true).then(({ serverUp }) => setIsOnline(serverUp));
      });

  };

  const OfferDraft = (draft) => {
    const lineCount = (draft.lines ?? []).filter(line => line.state !== 'D').length;
    MessageBox.alert('Unsaved Return',
      `A return was not saved (${MODE_NAMES[draft.mode] ?? ''}${draft.supplier ? ', supplier ' + draft.supplier.code : ''}, ${lineCount} line${lineCount === 1 ? '' : 's'}).\nDo you want to restore it ?`,
      [
        {
          text: 'Discard', style: 'cancel', onPress: () => {
            draftReady.current = true;
            SupplierReturnData.ClearDraft();
          }
        },
        {
          text: 'Restore', onPress: () => {
            draftReady.current = true;
            setMode(draft.mode ?? '');
            setSupplier(draft.supplier ?? null);
            setLines((draft.lines ?? []).map(line => ({ ...line, key: newLineKey() })));
            setLoadedLines(draft.loadedLines ?? []);
            setPendingReturnId(draft.pendingReturnId ?? null);
            focusScanner();
          }
        },
      ]);
  };

  const ResetForm = () => {
    setMode('');
    setSupplier(null);
    setLines([]);
    setLoadedLines([]);
    setLinesFilter('');
    setEditor(null);
    setPicker('');
    setNotice(null);
    setPendingReturnId(null);
  };

  // Loads a list of the server once (else again when reload)
  const LoadList = (list, setList, load, reload = false) => {
    if (list.loading || (list.rows !== null && !reload)) return;
    setList({ rows: list.rows, loading: true, error: '' });
    load()
      .then(rows => setList({ rows: rows, loading: false, error: '' }))
      .catch(error => {
        setList({ rows: null, loading: false, error: error.message });
        ShowError(error.message, 'Loading');
      });
  };

  //#region Header

  const StartMode = async (newMode) => {
    if (!setup) {
      LoadSetup();
      return;
    }
    const { serverUp } = await getConnectivity(true);
    const offline = !serverUp;
    if (offline && !hasOfflineCatalog) {
      ShowError('Download Offline Data While Online Before Using The App Offline.', 'Offline');
      return;
    }
    ResetForm();
    setMode(newMode);
    OpenSupplierPicker(newMode);
  };

  // View (and offline Modify / Delete) : saved returns on device or on server; Add : all active suppliers
  const OpenSupplierPicker = async (forMode = mode) => {
    const { serverUp } = await getConnectivity(true);
    const offline = hasOfflineCatalog && !serverUp;
    if (forMode === 'V' || (offline && (forMode === 'M' || forMode === 'D'))) {
      LoadList(returnSuppliers, setReturnSuppliers, SupplierReturnData.GetReturnSuppliers, true);
    } else {
      LoadList(suppliers, setSuppliers, SupplierReturnData.GetSuppliers, offline);
    }
    setPicker('supplier');
  };

  // Add : the supplier cannot change once there are lines (EnableDisableHeaderControls),
  // View / Modify / Delete : another supplier loads its returns
  const canChangeSupplier = mode !== '' && (mode !== 'A' || activeLines.length === 0);

  // Modify with changes : they are lost when another supplier is loaded, asks first
  const ChooseSupplier = (supplierCode) => {
    if (!hasChanges) {
      PickSupplier(supplierCode);
      return;
    }
    setPicker('');
    MessageBox.alert('Supplier', 'Do You Want To Discard Changes ?', [
      { text: 'No', style: 'cancel', onPress: focusScanner },
      { text: 'Yes', style: 'destructive', onPress: () => PickSupplier(supplierCode) },
    ]);
  };

  const PickSupplier = async (supplierCode) => {

    setPicker('');
    setIsBusy(true);

    const { serverUp } = await getConnectivity(true);
    const offline = hasOfflineCatalog && !serverUp;

    if (mode === 'A' && offline) {
      try {
        const rows = await OfflineStore.getSuppliers();
        const code = supplierCode.trim();
        const picked = rows.find(row => (row.code ?? '').trim() === code);
        if (!picked) throw new Error('Invalid Supplier');
        setLinesFilter('');
        setPendingReturnId(null);
        setSupplier(picked);
        setLines([]);
      } catch (error) {
        ShowError(error.message, 'Supplier');
      } finally {
        setIsBusy(false);
        focusScanner();
      }
      return;
    }

    SupplierReturnData.GetSupplierReturns(supplierCode, mode === 'V')
      .then(result => {

        setLinesFilter('');
        setPendingReturnId(result.pendingId ?? null);

        if (mode === 'A') {
          setSupplier(result.supplier);
          setLines([]);
          if (result.lines.length > 0) {
            MessageBox.alert('Supplier', 'This Supplier Has A File Return.', [{ text: 'OK', onPress: focusScanner }]);
          }
          return;
        }

        if (result.lines.length === 0) {
          setSupplier(null);
          setLines([]);
          ShowError(`No Returns Were Found For ${result.supplier.code} - ${result.supplier.name}`, 'Supplier');
          return;
        }

        // loadKey : the line as it was loaded, to know if it was changed
        const loaded = result.lines.map((line, index) => ({ ...line, state: '', loadKey: index }));
        setSupplier(result.supplier);
        setLines(loaded.map(line => ({ ...line, key: newLineKey() })));
        setLoadedLines(loaded);

      })
      .catch(error => ShowError(error.message, 'Supplier'))
      .finally(() => {
        setIsBusy(false);
        focusScanner();
      });

  };

  //#endregion

  //#region Items

  const CanAddItem = () => {
    if (mode !== 'A') {
      ShowError('Choose Add To Add Items', 'Scan');
      return false;
    }
    if (!supplier) {
      ShowError('Please Choose The Supplier First', 'Scan');
      return false;
    }
    return true;
  };

  // The item scanned (code) or picked in the stock search (code = its reference, itemRecID)
  const LoadItem = (code, itemRecID = '') => {

    setIsBusy(true);

    SupplierReturnData.FindReturnItem(code, itemRecID)
      .then(result => {

        // A code of more than one item : its items are shown to pick one
        if (result.matches) {
          PlayScanError();
          ShowNotice(`${result.matches.length} Items Have This Code, Choose One`);
          setMatches(result.matches);
          setPicker('matches');
          return;
        }

        const item = result.item;
        const defaultWarehouse = setup.warehouses.some(warehouse => warehouse.code === setup.defaultWarehouse) ? setup.defaultWarehouse : '';

        PlayScanOk();
        setEditor({
          isNewLine: true,
          line: {
            key: newLineKey(),
            itemRecID: item.itemRecID,
            counter: 0,
            itemReference: item.itemReference,
            unit: item.unit,
            description: item.description,
            barcode: item.barcode,
            date: item.date,
            basicUnit: item.basicUnit,
            qtyReturn: 1,
            oldQtyReturn: 0,
            warehouse: defaultWarehouse,
            remarks: '',
            stock: item.stock,
            state: 'A',
          },
        });

      })
      .catch(error => ShowError(error.message, 'Item'))
      .finally(() => {
        setIsBusy(false);
        focusScanner();
      });

  };

  const HandleScan = (scannedText) => {
    if (scannedText.trim() === '' || isBusy) return;
    if (!CanAddItem()) return;
    LoadItem(scannedText);
  };

  const OpenStockSearch = () => {
    if (!CanAddItem()) return;
    LoadList(stockSearch, setStockSearch, SupplierReturnData.GetStockSearch);
    setPicker('stock');
  };

  const PickItem = (item) => {
    setPicker('');
    LoadItem(item.itemReference, item.itemRecID);
  };

  const SubmitLine = (line) => {
    setLines(current => editor.isNewLine ?
      [...current, line] :
      current.map(currentLine => currentLine.key === line.key ? line : currentLine));
    setEditor(null);
    ShowNotice(`${editor.isNewLine ? 'Added' : 'Changed'} ${line.itemReference} : ${Number(line.qtyReturn).toFixed(qtyDecimals)} ${line.unit}`);
    focusScanner();
  };

  // Add / Modify : the line is changed, View / Delete : it is shown
  const OpenLine = (line) => {
    setEditor({ isNewLine: false, line: line });
  };

  // Add : the line is removed, Modify : it is deleted when saving (its returned quantity is taken off the stock)
  const DeleteLine = (line) => {
    MessageBox.alert('Delete', 'Do you want to delete the selected record ?', [
      { text: 'No', style: 'cancel', onPress: focusScanner },
      {
        text: 'Yes', style: 'destructive', onPress: () => {
          setLines(current => mode === 'M' ?
            current.map(currentLine => currentLine.key === line.key ? { ...currentLine, state: 'D' } : currentLine) :
            current.filter(currentLine => currentLine.key !== line.key));
          ShowNotice(`Deleted ${line.itemReference}`);
          focusScanner();
        }
      },
    ]);
  };

  //#endregion

  //#region Save / Cancel

  const Save = () => {

    if (isBusy || mode === '' || mode === 'V') return;

    if (!supplier) {
      ShowError('Please Choose The Supplier First', 'Save');
      return;
    }
    if (mode === 'A' && lines.length === 0) {
      ShowError('No Records To Save.', 'Save');
      return;
    }
    if (mode === 'M' && !hasChanges) {
      MessageBox.alert('Save', 'Nothing Was Changed.', [{ text: 'OK', onPress: focusScanner }]);
      return;
    }

    MessageBox.alert('Save', mode === 'D' ?
      `Do You Really Want To Delete All The Returns Of ${supplier.code} - ${supplier.name} ?` :
      'Do You Really Want To Save Changes?', [
      { text: 'No', style: 'cancel', onPress: focusScanner },
      { text: 'Yes', onPress: SaveReturns },
    ]);

  };

  const SaveReturns = async () => {

    setIsBusy(true);

    SupplierReturnData.SaveSupplierReturns(
      supplier.code,
      mode,
      mode === 'D' ? [] : lines,
      { pendingId: pendingReturnId, supplier },
    )
      .then(({ savedOnDevice }) => {
        SupplierReturnData.ClearDraft();
        ResetForm();
        RefreshOfflineState();
        MessageBox.alert('Save', savedOnDevice ?
          'Saved On Device.\nUpload When You Are Online.' :
          'Saved Successfully');
      })
      .catch(error => {
        ShowError(error.message, 'Save');
      })
      .finally(() => setIsBusy(false));

  };

  // Add : removes all the lines and the supplier, Modify : the lines as they were loaded (the changes and deletions are undone)
  // Asks only when something would be lost
  const Clear = () => {
    const ClearAdd = () => {
      setSupplier(null);
      setLines([]);
      setPendingReturnId(null);
      setLinesFilter('');
      focusScanner();
    };
    if (mode === 'A' && lines.length === 0) {
      ClearAdd();
      return;
    }
    if (mode === 'M' && !hasChanges) return;
    MessageBox.alert('Clear', mode === 'M' ?
      'Do You Want To Undo All The Changes And Get The Returns As They Were Loaded ?' :
      'Do You Want To Remove All The Lines And The Supplier ?', [
      { text: 'No', style: 'cancel', onPress: focusScanner },
      {
        text: 'Yes', style: 'destructive', onPress: () => {
          if (mode === 'M') {
            setLines(loadedLines.map(line => ({ ...line, key: newLineKey() })));
            setLinesFilter('');
            ShowNotice('Returns Loaded Again');
            focusScanner();
          } else {
            ClearAdd();
            ShowNotice('Records Cleared');
          }
        }
      },
    ]);
  };

  const Cancel = () => {
    if (!hasChanges) {
      ResetForm();
      return;
    }
    MessageBox.alert('Cancel', 'Do You Want To Discard Changes ?', [
      { text: 'No', style: 'cancel', onPress: focusScanner },
      {
        text: 'Yes', style: 'destructive', onPress: () => {
          SupplierReturnData.ClearDraft();
          ResetForm();
        }
      },
    ]);
  };

  //#endregion

  const warehouseDescription = (code) => setup?.warehouses.find(warehouse => warehouse.code === code)?.description ?? code;

  const totalQty = activeLines.reduce((total, line) => total + (Number(line.qtyReturn) || 0), 0);

  const canEditLines = mode === 'A' || mode === 'M';

  const LineRow = ({ item }) => (
    <TouchableOpacity style={styles.lineRow} onPress={() => OpenLine(item)}>
      <View style={styles.lineTextContainer}>
        <View style={styles.lineHeader}>
          <Text style={styles.lineReferenceText} numberOfLines={1}>{item.itemReference}</Text>
          <Text style={styles.lineQtyText} numberOfLines={1}>
            {Number(item.qtyReturn).toFixed(qtyDecimals)} <Text style={styles.lineUnitText}>{item.unit}</Text>
          </Text>
        </View>
        <Text style={styles.lineDescriptionText} numberOfLines={1}>{item.description}</Text>
        <Text style={styles.lineDetailText} numberOfLines={1}>
          {item.date ? item.date + ' · ' : ''}{warehouseDescription(item.warehouse)}{item.remarks ? ' · ' + item.remarks : ''}{item.state === 'M' ? ' · Changed' : ''}
        </Text>
      </View>
      {canEditLines ?
        <TouchableOpacity style={styles.lineDeleteButton} onPress={() => DeleteLine(item)}>
          <Image source={require('../assets/icons/deleteLine.png')} style={styles.lineDeleteImage} resizeMode='contain' />
        </TouchableOpacity> :
        <></>}
    </TouchableOpacity>
  );

  const HomeButton = ({ title, description, imageSource, newMode, onPress, disabled }) => (
    <TouchableOpacity
      style={[styles.homeButton, disabled ? styles.homeButtonDisabled : null]}
      disabled={disabled || isBusy}
      onPress={onPress ?? (() => StartMode(newMode))}>
      <Image source={imageSource} style={styles.homeButtonImage} resizeMode='contain' />
      <Text style={styles.homeButtonText}>{title}</Text>
      <Text style={styles.homeButtonDescriptionText}>{description}</Text>
    </TouchableOpacity>
  );

  const returnRecordsInfo = (recordCount) =>
    `1 Return With A Total Of ${recordCount} Record${recordCount === 1 ? '' : 's'}`;

  const emptyText = !setup ? '' :
    !supplier ? 'Choose The Supplier' :
      mode === 'A' ? 'Scan Or Search The Items To Return' :
        linesFilter !== '' ? 'Nothing Found' : 'No Returns';

  const pickingSavedOnDevice = !isOnline && hasOfflineCatalog && (mode === 'M' || mode === 'D');
  const supplierRows = mode === 'V' || pickingSavedOnDevice ? returnSuppliers : suppliers;

  return (
    <View style={styles.container}>

      <FilterList
        visible={picker === 'supplier'}
        title={mode === 'V' ? 'Suppliers Having Returns' : pickingSavedOnDevice ? 'Saved Returns On Device' : 'Supplier'}
        placeholder='Search Suppliers (Code, Name)'
        rows={supplierRows.rows}
        loading={supplierRows.loading}
        error={supplierRows.error}
        onRetry={() => OpenSupplierPicker()}
        rowKey={(row) => row.code}
        rowTitle={(row) => row.code}
        rowDescription={(row) => row.name}
        rowInfo={(mode === 'V' || pickingSavedOnDevice) ?
          (row => `${returnRecordsInfo(row.lines ?? row.lineCount ?? 0)} · ${row.lastDate ?? row.savedAt?.slice(0, 10) ?? ''}`) :
          undefined}
        searchString={(row) => (row.code + ' ' + row.name).toUpperCase()}
        onPick={(row) => ChooseSupplier(row.code)}
        onClose={() => {
          setPicker('');
          focusScanner();
        }}
      />

      <FilterList
        visible={picker === 'matches'}
        title='Choose The Item'
        placeholder='Search Items'
        rows={matches}
        rowKey={(row) => row.itemRecID}
        rowTitle={(row) => row.itemReference}
        rowDescription={(row) => row.description}
        searchString={(row) => (row.itemReference + ' ' + row.description).toUpperCase()}
        onPick={PickItem}
        onClose={() => {
          setPicker('');
          focusScanner();
        }}
      />

      <StockSearch
        visible={picker === 'stock'}
        stockSearch={stockSearch.rows}
        loading={stockSearch.loading}
        error={stockSearch.error}
        onRetry={() => LoadList(stockSearch, setStockSearch, SupplierReturnData.GetStockSearch, true)}
        supplierFilter={mode === 'A' && supplier ? `${supplier.code.trim()}/` : ''}
        onPick={PickItem}
        onClose={() => {
          setPicker('');
          focusScanner();
        }}
      />

      <ReturnLineEditor
        visible={editor !== null}
        line={editor?.line}
        isNewLine={editor?.isNewLine}
        readOnly={!canEditLines}
        warehouses={setup?.warehouses ?? []}
        qtyDecimals={qtyDecimals}
        onSubmit={SubmitLine}
        onCancel={() => {
          setEditor(null);
          focusScanner();
        }}
      />

      <Modal visible={serverModalVisible} transparent={true} animationType='fade' onRequestClose={() => setServerModalVisible(false)}>
        <View style={styles.serverModalBackdrop}>
          <View style={styles.serverModalPanel}>
            <ModalTitle
              title='Server'
              onCloseButtonPress={() => setServerModalVisible(false)}
              clearData={() => { }}
            />
            <TextInput
              style={styles.serverInput}
              value={serverDraft}
              onChangeText={setServerDraft}
              autoCapitalize='none'
              autoCorrect={false}
            />
            <View style={styles.serverModalButtons}>
              <MainButton title='Save' onPress={SaveServer} style={styles.serverSaveButton} />
            </View>
          </View>
        </View>
      </Modal>

      <FilterList
        visible={uploadPickerVisible}
        title='Upload Saved Returns'
        placeholder='Search Saved Returns'
        rows={pendingUploadRows}
        rowKey={(row) => String(row.id)}
        rowTitle={(row) => row.supplier.code}
        rowDescription={(row) => row.supplier.name}
        rowInfo={(row) => `${row.lineCount} Record${row.lineCount === 1 ? '' : 's'} · ${row.savedAt.slice(0, 10)}`}
        searchString={(row) => (row.supplier.code + ' ' + row.supplier.name).toUpperCase()}
        onPick={(row) => OpenUploadReview(row)}
        onClose={() => setUploadPickerVisible(false)}
        footer={
          <View style={[styles.buttonsContainer, styles.uploadButtonsContainer]}>
            <MainButton title='Close' style={styles.uploadButton} imageSource={require('../assets/icons/close.png')} onPress={() => setUploadPickerVisible(false)} />
            <MainButton title='Upload' style={styles.uploadButton} imageSource={require('../assets/icons/upload.png')} onPress={UploadAll} />
          </View>
        }
      />

      <Modal visible={uploadReview !== null} onRequestClose={() => setUploadReview(null)}>
        <View style={styles.container}>
          <ModalTitle
            title={uploadReview ? `${uploadReview.supplier.code} - ${uploadReview.supplier.name}` : 'Upload'}
            onCloseButtonPress={() => setUploadReview(null)}
          />
          <Text style={styles.uploadHintText}>The return saved on this device. Upload in the list sends all the saved returns to the server.</Text>
          <FlatList
            style={styles.linesList}
            data={uploadReview?.lines ?? []}
            keyExtractor={(line, index) => `${line.itemRecID}-${index}`}
            renderItem={({ item }) => (
              <View style={styles.lineRow}>
                <View style={styles.lineTextContainer}>
                  <Text style={styles.lineReferenceText} numberOfLines={1}>{item.itemReference}</Text>
                  <Text style={styles.lineDescriptionText} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.lineDetailText} numberOfLines={1}>
                    {Number(item.qtyReturn).toFixed(qtyDecimals)} {item.unit} · WH {item.warehouse}{item.remarks ? ' · ' + item.remarks : ''}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No Records</Text>}
          />
          <View style={[styles.buttonsContainer, styles.uploadButtonsContainer]}>
            <MainButton title='Close' style={styles.backButton} imageSource={require('../assets/icons/close.png')} onPress={() => setUploadReview(null)} />
          </View>
        </View>
      </Modal>

      {/* Mode, user and location (status bar of SuperStore) */}
      <View style={styles.infoBar}>
        <Text style={styles.infoModeText}>{MODE_NAMES[mode]}</Text>
        {mode === '' ?
          <Pressable
            onPress={OnInfoPress}
            style={({ pressed }) => [
              styles.infoTextTouchable,
              pressed && styles.infoTextTouchablePressed,
            ]}>
            {({ pressed }) => (
              <Text style={[styles.infoText, pressed && styles.infoTextPressed]} numberOfLines={1}>
                User {setup?.userCode ?? ''} · Location {setup?.location ?? ''}
              </Text>
            )}
          </Pressable> :
          <Text style={styles.infoTextStatic} numberOfLines={1}>
            User {setup?.userCode ?? ''} · Location {setup?.location ?? ''}
          </Text>}
      </View>

      {mode === '' ?
        <>
          <View style={styles.homeMain}>
            <View style={styles.homeContainer}>
              <HomeButton title='View' description='See The Returns' imageSource={require('../assets/icons/viewReturns.png')} newMode='V' />
              <HomeButton title='Add' description='New Returns' imageSource={require('../assets/icons/add.png')} newMode='A' />
              <HomeButton title='Modify' description='Change Returns' imageSource={require('../assets/icons/ReturnOrders.png')} newMode='M' />
              <HomeButton title='Delete' description='All The Returns' imageSource={require('../assets/icons/deleteLine.png')} newMode='D' />
              <HomeButton
                title='Download'
                description='For Offline Work'
                imageSource={require('../assets/icons/download.png')}
                disabled={!isOnline}
                onPress={DownloadOfflineCatalog}
              />
              <HomeButton
                title='Upload'
                description={pendingCount > 0 ? formatReturnsRecords(pendingCount, pendingRecordCount) : 'Saved On Device'}
                imageSource={require('../assets/icons/upload.png')}
                disabled={!isOnline || pendingCount === 0}
                onPress={OpenUploadPicker}
              />
            </View>
          </View>
          <View style={styles.homeFooter}>
            <View style={styles.footerStatusRow}>
              <View style={styles.footerOnlineGroup}>
                <View style={[styles.connectivityRing, isOnline ? styles.connectivityOnline : styles.connectivityOffline]} />
                <Text style={styles.footerStatusText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
              {hasOfflineCatalog && lastDownloadAt ?
                <Text style={styles.footerDownloadText} numberOfLines={1}>
                  Last Download : {formatDownloadDateTime(lastDownloadAt)}
                </Text> :
                <></>}
            </View>
          </View>
        </> :
        <>
          <View style={choiceRowStyle.row}>
            <ChoiceField title='Supplier'
              value={supplier ? `${supplier.code} - ${supplier.name}` : 'Choose'}
              onPress={canChangeSupplier ? () => OpenSupplierPicker() : undefined}
              style={{ borderRightWidth: 0, borderBottomWidth: 0 }} />
          </View>

          {mode === 'A' ?
            <View style={styles.scannerContainer}>

              {/* The icon opens the stock search */}
              <TouchableOpacity style={styles.scannerButton} disabled={isBusy} onPress={OpenStockSearch}>
                <Image
                  source={require('../assets/icons/barcode.png')}
                  style={styles.scannerImage}
                  resizeMode='contain'
                />
              </TouchableOpacity>

              <TextInput
                ref={scannerInputControl}
                style={styles.scannerText}
                value={scanner}
                onChangeText={setScanner}
                showSoftInputOnFocus={false}
                onPressIn={() => Keyboard.dismiss()}
                placeholder='Scan Item'
                maxLength={200}
                autoFocus={true}
                blurOnSubmit={false}
                onSubmitEditing={() => {
                  HandleScan(scanner);
                  setScanner('');
                }}
              />

            </View> :
            supplier ?
              <View style={styles.linesFilterContainer}>
                <TextInput
                  style={styles.linesFilterText}
                  placeholder='Search Returns (Reference, Barcode, Description)'
                  maxLength={50}
                  value={linesFilter}
                  autoCapitalize='characters'
                  onChangeText={setLinesFilter}
                />
              </View> :
              <></>}

          {/* The notice of the last action, hidden after a few seconds */}
          {notice ?
            <View style={styles.statusContainer}>
              <Text style={styles.statusText} numberOfLines={1}>{notice}</Text>
            </View> :
            <></>}

          <FlatList
            style={styles.linesList}
            data={shownLines}
            keyExtractor={(line) => line.key}
            renderItem={LineRow}
            keyboardShouldPersistTaps='handled'
            ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
          />

          <View style={styles.totalContainer}>
            <Text style={styles.totalText}>{linesFilter !== '' ? `${shownLines.length} / ` : ''}{activeLines.length} Record{activeLines.length === 1 ? '' : 's'}</Text>
            <Text style={styles.totalText}>Total Qty : <Text style={styles.totalValueText}>{totalQty.toFixed(qtyDecimals)}</Text></Text>
          </View>

          <View style={styles.buttonsContainer}>
            {mode === 'V' ?
              <MainButton title='Back' style={styles.backButton} imageSource={require('../assets/icons/close.png')} onPress={ResetForm} /> :
              <>
                <MainButton title='Save' style={canEditLines ? styles.modeButton : null} imageSource={require('../assets/icons/upload.png')} onPress={Save} />
                {canEditLines ?
                  <MainButton title='Clear' style={styles.modeButton} imageSource={require('../assets/icons/clear.png')} onPress={Clear} /> :
                  <></>}
                <MainButton title='Cancel' style={canEditLines ? styles.modeButton : null} imageSource={require('../assets/icons/close.png')} onPress={Cancel} />
              </>}
          </View>
        </>}

      {isBusy ? <LoadingData /> : <></>}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgColor,
  },
  homeMain: {
    flex: 1,
  },
  homeFooter: {
    backgroundColor: Colors.brandGreen,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerOnlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerDownloadText: {
    flex: 1,
    marginLeft: 10,
    fontSize: FontSize(12),
    color: 'white',
    textAlign: 'right',
  },
  connectivityRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  connectivityOnline: {
    backgroundColor: '#2ecc40',
  },
  connectivityOffline: {
    backgroundColor: '#ff4136',
  },
  footerStatusText: {
    fontSize: FontSize(16),
    color: 'white',
    fontWeight: 'bold',
  },
  uploadHintText: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize(14),
    color: Colors.brandBlue,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.listItemBackColor,
  },
  infoModeText: {
    color: Colors.brandGreen,
    fontSize: FontSize(15),
    fontWeight: 'bold',
    marginRight: 10,
  },
  infoTextTouchable: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  infoTextTouchablePressed: {
    backgroundColor: 'silver',
  },
  infoText: {
    textAlign: 'right',
    color: '#555',
    fontSize: FontSize(16),
  },
  infoTextStatic: {
    flex: 1,
    textAlign: 'right',
    color: '#555',
    fontSize: FontSize(16),
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  infoTextPressed: {
    color: Colors.brandBlue,
  },
  serverModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  serverModalPanel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.bgColor,
    borderRadius: 4,
    overflow: 'hidden',
  },
  serverInput: {
    margin: 12,
    borderWidth: 1,
    borderColor: 'silver',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize(16),
    color: 'black',
  },
  serverModalButtons: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  serverSaveButton: {
    width: '100%',
  },
  homeContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  homeButtonDisabled: {
    opacity: 0.45,
  },
  homeButton: {
    width: '48.5%',
    height: Sizing.windowsHeight * 0.21,
    marginBottom: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.buttonBorderColor,
    backgroundColor: Colors.buttonBackColor1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  homeButtonImage: {
    width: '45%',
    height: '40%',
    marginBottom: 8,
  },
  homeButtonText: {
    color: Colors.brandBlue,
    fontSize: FontSize(22),
    fontWeight: 'bold',
  },
  homeButtonDescriptionText: {
    color: Colors.brandGreen,
    fontSize: FontSize(14),
  },
  scannerContainer: {
    backgroundColor: Colors.brandGreen,
    width: '100%',
    height: 55,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerButton: {
    width: 44,
    height: '100%',
    marginRight: 5,
    borderRadius: 6,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerImage: {
    width: 34,
    height: '80%',
  },
  scannerText: {
    flex: 1,
    height: '100%',
    backgroundColor: 'white',
    color: 'black',
    fontSize: FontSize(18),
    borderWidth: 1,
    borderColor: 'gainsboro',
    borderRadius: 4,
    paddingLeft: 10,
  },
  linesFilterContainer: {
    width: '100%',
    height: 50,
    padding: 5,
    backgroundColor: Colors.brandGreen,
  },
  linesFilterText: {
    flex: 1,
    backgroundColor: 'white',
    color: 'black',
    fontSize: FontSize(16),
    borderWidth: 1,
    borderColor: 'gainsboro',
    borderRadius: 4,
    paddingLeft: 10,
    paddingVertical: 0,
  },
  statusContainer: {
    width: '100%',
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: Colors.brandBlue,
  },
  statusText: {
    color: 'white',
    fontSize: FontSize(17),
    fontWeight: 'bold',
  },
  linesList: {
    flex: 1,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingLeft: 12,
    paddingRight: 12,
    paddingVertical: 4,
    backgroundColor: Colors.listItemBackColor,
    marginBottom: 2,
  },
  lineTextContainer: {
    flex: 1,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineReferenceText: {
    flex: 1,
    color: Colors.brandBlue,
    fontSize: FontSize(17),
    fontWeight: 'bold',
  },
  lineQtyText: {
    color: Colors.brandBlue,
    fontSize: FontSize(17),
    fontWeight: 'bold',
    marginLeft: 5,
  },
  lineUnitText: {
    color: Colors.brandGreen,
  },
  lineDescriptionText: {
    color: 'black',
    fontSize: FontSize(15),
  },
  lineDetailText: {
    color: 'gray',
    fontSize: FontSize(13),
  },
  lineDeleteButton: {
    width: 44,
    height: 48,
    marginRight: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineDeleteImage: {
    width: 28,
    height: 28,
  },
  emptyText: {
    textAlign: 'center',
    color: 'gray',
    fontSize: FontSize(16),
    padding: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    paddingHorizontal: 12,
    borderColor: 'silver',
    borderTopWidth: 1,
  },
  totalText: {
    color: Colors.brandBlue,
    fontSize: FontSize(16),
    fontWeight: 'bold',
  },
  totalValueText: {
    color: Colors.brandGreen,
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  modeButton: {
    width: '32%',
  },
  backButton: {
    width: '100%',
  },
  uploadButtonsContainer: {
    paddingBottom: 6,
  },
  uploadButton: {
    width: '49%',
  },
});

export default SupplierReturnScreen;
