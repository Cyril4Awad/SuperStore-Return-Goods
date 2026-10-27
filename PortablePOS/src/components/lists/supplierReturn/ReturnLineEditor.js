import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import Colors from '../../../variables/Colors';
import Sizing from '../../../variables/Sizing';
import { FontSize } from '../../../variables/ResponsiveFont';
import ModalTitle from '../../ModalTitle';
import LoadingData from '../../LoadingData';
import DataField from '../../controls/DataField';
import ChoiceField, { choiceRowStyle, choiceTitleTextStyle } from '../../controls/ChoiceField';
import OptionPicker from '../../controls/OptionPicker';
import MessageBox from '../../MessageBox';
import SupplierReturnData from '../../../data/SupplierReturnData';

const MAX_QTY = 999999;

const comparableLine = (line, qtyDecimals) => {
    const factor = Math.pow(10, qtyDecimals);
    return {
        qtyReturn: Math.round((Number(line.qtyReturn) || 0) * factor) / factor,
        unit: line.unit ?? '',
        warehouse: line.warehouse ?? '',
        remarks: (line.remarks ?? '').trim(),
    };
};

const linesEqual = (left, right, qtyDecimals) => {
    const a = comparableLine(left, qtyDecimals);
    const b = comparableLine(right, qtyDecimals);
    return a.qtyReturn === b.qtyReturn
        && a.unit === b.unit
        && a.warehouse === b.warehouse
        && a.remarks === b.remarks;
};

// The row editor of the return (pnlRowEditor of FrmSupplierReturnQty) : the item scanned / searched, its unit,
// the quantity to return, the warehouse and the remarks; Qty In Warehouses shows the stock of the item in each warehouse (in the unit)
// The unit and the warehouse are changed on the lines added (Add), Modify changes the quantity and the remarks, View changes nothing
// Remarks opens a box at the top of the screen, the keyboard does not cover what is typed
// props : visible, line, isNewLine, readOnly, warehouses [{ code, description }], qtyDecimals, onSubmit(line), onCancel
const ReturnLineEditor = props => {

    const [line, setLine] = useState(null);
    // The return qty typed in its box (the line keeps the number)
    const [qtyInput, setQtyInput] = useState('');
    const qtyInputControl = useRef(null);
    // The keyboard of the screen opens only when the qty box is tapped (the keys of the scanner type in it)
    const [qtySoftKeyboard, setQtySoftKeyboard] = useState(false);
    const contentControl = useRef(null);
    const qtyRowY = useRef(0);
    const [units, setUnits] = useState([]);
    const [unitPickerVisible, setUnitPickerVisible] = useState(false);
    const [warehousePickerVisible, setWarehousePickerVisible] = useState(false);
    const [stockVisible, setStockVisible] = useState(false);
    // The remarks typed in the box, null when it is closed
    const [remarksText, setRemarksText] = useState(null);
    const [isBusy, setIsBusy] = useState(false);
    const [baselineLine, setBaselineLine] = useState(null);

    useEffect(() => {
        if (!props.visible) {
            setBaselineLine(null);
            setLine(null);
            return;
        }
        const snapshot = { ...props.line };
        setLine(snapshot);
        setBaselineLine(snapshot);
        setQtyInput((Number(snapshot.qtyReturn) || 0).toFixed(props.qtyDecimals));
        setQtySoftKeyboard(false);
        // An item scanned / searched : the qty box gets the focus, its text selected so typing replaces it
        if (props.isNewLine && !props.readOnly) {
            const timer = setTimeout(() => qtyInputControl.current?.focus(), 300);
            return () => clearTimeout(timer);
        }
    }, [props.visible, props.isNewLine, props.readOnly, props.line?.key]);

    if (!line || !baselineLine) return null;

    const hasChanges = () => !linesEqual(line, baselineLine, props.qtyDecimals);

    // A line added (not saved yet) : its unit and warehouse can change
    const canChangeItem = !props.readOnly && line.state === 'A';

    const qtyText = (value) => (Number(value) || 0).toFixed(props.qtyDecimals);

    const warehouseDescription = (code) => props.warehouses.find(warehouse => warehouse.code === code)?.description ?? code;

    // A change of an existing line of Modify : its stock is updated by the difference with the old quantity
    const changeLine = (changes) => setLine(current => ({
        ...current,
        ...changes,
        state: current.state === '' ? 'M' : current.state,
    }));

    const ChangeQty = (step) => {
        const qty = Math.round(((Number(line.qtyReturn) || 0) + step) * 100) / 100;
        if (qty <= 0 || qty > MAX_QTY) return;
        changeLine({ qtyReturn: qty });
        setQtyInput(qtyText(qty));
    };

    // A tap on the qty box : it gets the focus again, this time with the keyboard of the screen
    const OpenQtyKeyboard = () => {
        if (qtySoftKeyboard) return;
        setQtySoftKeyboard(true);
        qtyInputControl.current?.blur();
        setTimeout(() => qtyInputControl.current?.focus(), 100);
    };

    // Once the keyboard has made the screen smaller, the qty row is brought to the top of the content
    const ScrollToQty = () => {
        if (!qtySoftKeyboard) return;
        setTimeout(() => contentControl.current?.scrollTo({ y: Math.max(qtyRowY.current - 8, 0), animated: true }), 250);
    };

    // Digits and one decimal point, qtyDecimals decimals at most, MAX_QTY at most
    const TypeQty = (typed) => {
        const [whole, ...decimals] = typed.replace(',', '.').replace(/[^0-9.]/g, '').split('.');
        const cleaned = decimals.length > 0 ? `${whole}.${decimals.join('').slice(0, props.qtyDecimals)}` : whole;
        if ((Number(cleaned) || 0) > MAX_QTY) return;
        setQtyInput(cleaned);
        changeLine({ qtyReturn: Number(cleaned) || 0 });
    };

    const ChooseUnit = () => {
        setIsBusy(true);
        SupplierReturnData.GetItemUnits(line.itemRecID)
            .then(itemUnits => {
                setUnits(itemUnits);
                setUnitPickerVisible(true);
            })
            .catch(error => MessageBox.alert('Unit', error.message))
            .finally(() => setIsBusy(false));
    };

    // The barcode of the unit (else the one of the item stays) and the stock shown in the unit
    const PickUnit = (unit) => {
        setUnitPickerVisible(false);
        setIsBusy(true);
        SupplierReturnData.GetItemUnit(line.itemRecID, unit)
            .then(itemUnit => changeLine({
                unit: itemUnit.unit,
                barcode: itemUnit.barcode !== '' ? itemUnit.barcode : line.barcode,
                stock: itemUnit.stock,
            }))
            .catch(error => MessageBox.alert('Unit', error.message))
            .finally(() => setIsBusy(false));
    };

    const RequestCancel = () => {
        if (props.readOnly || !hasChanges()) {
            props.onCancel();
            return;
        }
        MessageBox.alert('Return Line', 'Do You Want To Discard Changes ?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes', style: 'destructive', onPress: props.onCancel },
        ]);
    };

    const Submit = () => {
        if (props.readOnly) {
            props.onCancel();
            return;
        }
        if (!(Number(line.qtyReturn) > 0)) {
            MessageBox.alert('Return Qty', 'Quantity To Return Must Be Greater Than 0');
            return;
        }
        if (!line.unit || !line.warehouse) {
            MessageBox.alert('Return Line', 'Please Fill The Unit And The Warehouse');
            return;
        }
        if (!props.isNewLine && !hasChanges()) {
            props.onCancel();
            return;
        }
        props.onSubmit({ ...line, remarks: (line.remarks ?? '').trim() });
    };

    const StockRow = ({ item }) => (
        <View style={styles.stockRow}>
            <Text style={styles.stockWarehouseText} numberOfLines={1}>{warehouseDescription(item.warehouse)}</Text>
            <Text style={[styles.stockQtyText, item.qty < 0 ? { color: 'red' } : null]} numberOfLines={1}>{item.display}</Text>
        </View>
    );

    const title = props.readOnly ? 'Return Line' : props.isNewLine ? 'Add Item' : 'Edit Item';

    return (
        <Modal visible={props.visible} onRequestClose={RequestCancel}>
            <View style={styles.container}>

                <OptionPicker
                    visible={unitPickerVisible}
                    title='Unit'
                    options={units.map(unit => ({ code: unit.code, description: `${unit.code} - ${unit.description}` }))}
                    selected={[line.unit]}
                    multiple={false}
                    onSubmit={(codes) => PickUnit(codes[0])}
                    onCancel={() => setUnitPickerVisible(false)}
                />

                <OptionPicker
                    visible={warehousePickerVisible}
                    title='Warehouse'
                    options={props.warehouses}
                    selected={[line.warehouse]}
                    multiple={false}
                    onSubmit={(codes) => {
                        changeLine({ warehouse: codes[0] });
                        setWarehousePickerVisible(false);
                    }}
                    onCancel={() => setWarehousePickerVisible(false)}
                />

                {/* The stock of the item in the active warehouses, in the unit of the line */}
                <Modal visible={stockVisible} transparent={true} presentationStyle="overFullScreen" onRequestClose={() => setStockVisible(false)}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalCard}>
                            <ModalTitle title={`Qty In Warehouses (${line.unit})`} onCloseButtonPress={() => setStockVisible(false)} />
                            <FlatList
                                data={line.stock ?? []}
                                keyExtractor={(stock) => stock.warehouse}
                                renderItem={StockRow}
                                ListEmptyComponent={<Text style={styles.emptyText}>No Stock</Text>}
                            />
                        </View>
                    </View>
                </Modal>

                {/* Remarks : at the top of the screen, above the keyboard */}
                <Modal visible={remarksText !== null} transparent={true} presentationStyle="overFullScreen" onRequestClose={() => setRemarksText(null)}>
                    <View style={styles.remarksModalContainer}>
                        <View style={styles.modalCard}>
                            <ModalTitle title='Remarks' onCloseButtonPress={() => setRemarksText(null)} />
                            <TextInput
                                style={styles.remarksModalText}
                                value={remarksText ?? ''}
                                maxLength={500}
                                multiline={true}
                                autoFocus={true}
                                textAlignVertical='top'
                                placeholder='Remarks'
                                onChangeText={setRemarksText}
                            />
                            <Text style={styles.remarksCountText}>{(remarksText ?? '').length} / 500</Text>
                            <View style={styles.footer}>
                                <TouchableOpacity style={styles.button} onPress={() => setRemarksText(null)}>
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.button} onPress={() => {
                                    changeLine({ remarks: remarksText });
                                    setRemarksText(null);
                                }}>
                                    <Text style={styles.buttonText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <ModalTitle title={title} onCloseButtonPress={RequestCancel} />

                {/* Scrolls : the keyboard of the qty leaves little room, the qty row is scrolled into view */}
                <ScrollView ref={contentControl} style={styles.content} contentContainerStyle={styles.contentContainer}
                    keyboardShouldPersistTaps='handled'>

                    <DataField title='Item Reference' data={line.itemReference} toolTip={line.barcode} />

                    {/* Two lines : the long descriptions are not cut on the first line */}
                    <View style={styles.descriptionContainer}>
                        <Text style={styles.descriptionTitleText}>Description</Text>
                        <Text style={styles.descriptionText} numberOfLines={2}>{line.description}</Text>
                    </View>

                    <View style={choiceRowStyle.row}>
                        <ChoiceField title='Unit' value={line.unit === line.basicUnit ? line.unit : `${line.unit} (Base ${line.basicUnit})`}
                            onPress={canChangeItem ? ChooseUnit : undefined}
                            style={{ borderBottomWidth: 0 }} />
                        <ChoiceField title='Qty In Warehouses'
                            value={`${(line.stock ?? []).length} Warehouses`}
                            onPress={() => setStockVisible(true)}
                            style={{ borderRightWidth: 0, borderBottomWidth: 0 }} />
                    </View>

                    {/* - / + change it by 1, the box is typed in (Done of the keyboard is OK) */}
                    <View style={styles.qtyRow} onLayout={(event) => { qtyRowY.current = event.nativeEvent.layout.y; }}>
                        <Text style={[choiceTitleTextStyle, styles.qtyTitleText]}>Return Qty</Text>
                        {props.readOnly ?
                            <Text style={styles.qtyReadOnlyText}>{qtyText(line.qtyReturn)} {line.unit}</Text> :
                            <>
                                <TouchableOpacity style={styles.qtyButton} onPress={() => ChangeQty(-1)}>
                                    <Text style={styles.qtyButtonText}>−</Text>
                                </TouchableOpacity>
                                <TextInput
                                    ref={qtyInputControl}
                                    style={[styles.qtyValueBox, styles.qtyValueText]}
                                    value={qtyInput}
                                    keyboardType='decimal-pad'
                                    selectTextOnFocus={true}
                                    showSoftInputOnFocus={qtySoftKeyboard}
                                    onPressIn={OpenQtyKeyboard}
                                    returnKeyType='done'
                                    maxLength={12}
                                    onChangeText={TypeQty}
                                    onFocus={ScrollToQty}
                                    onBlur={() => setQtyInput(qtyText(line.qtyReturn))}
                                    onSubmitEditing={Submit}
                                />
                                <TouchableOpacity style={styles.qtyButton} onPress={() => ChangeQty(1)}>
                                    <Text style={styles.qtyButtonText}>+</Text>
                                </TouchableOpacity>
                            </>}
                    </View>

                    <View style={choiceRowStyle.row}>
                        <ChoiceField title='Warehouse' value={warehouseDescription(line.warehouse)}
                            onPress={canChangeItem ? () => setWarehousePickerVisible(true) : undefined}
                            style={{ borderBottomWidth: 0 }} />
                        <ChoiceField title='Date' value={line.date ?? ''}
                            style={{ borderRightWidth: 0, borderBottomWidth: 0, flex: 0.6 }} />
                    </View>

                    <View style={styles.remarksContainer}>
                        <Text style={choiceTitleTextStyle}>Remarks</Text>
                        <TouchableOpacity style={styles.remarksBox} disabled={props.readOnly}
                            onPress={() => setRemarksText(line.remarks ?? '')}>
                            <Text style={line.remarks ? styles.remarksText : styles.remarksPlaceholderText} numberOfLines={4}>
                                {line.remarks ? line.remarks : props.readOnly ? '' : 'Tap To Type The Remarks'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>

                <View style={styles.footer}>
                    {props.readOnly ?
                        <TouchableOpacity style={styles.button} onPress={props.onCancel}>
                            <Text style={styles.buttonText}>Close</Text>
                        </TouchableOpacity> :
                        <>
                            <TouchableOpacity style={styles.button} onPress={RequestCancel}>
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.button} onPress={Submit}>
                                <Text style={styles.buttonText}>OK</Text>
                            </TouchableOpacity>
                        </>}
                </View>

                {isBusy ? <LoadingData /> : <></>}

            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bgColor,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 20,
    },
    descriptionContainer: {
        minHeight: 55,
        paddingHorizontal: 15,
        paddingVertical: 3,
        justifyContent: 'center',
        borderColor: 'silver',
        borderBottomWidth: 1,
    },
    descriptionTitleText: {
        color: Colors.brandBlue,
        fontSize: FontSize(15),
        fontWeight: 'bold',
    },
    descriptionText: {
        color: 'black',
        fontSize: FontSize(17),
    },
    qtyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        paddingHorizontal: 10,
        borderColor: 'silver',
        borderBottomWidth: 1,
    },
    qtyTitleText: {
        flex: 1,
    },
    qtyReadOnlyText: {
        fontSize: FontSize(20),
        fontWeight: 'bold',
        color: Colors.brandBlue,
    },
    qtyButton: {
        width: 40,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.buttonBorderColor,
        backgroundColor: Colors.buttonBackColor1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyButtonText: {
        color: Colors.brandBlue,
        fontSize: FontSize(22),
        fontWeight: 'bold',
    },
    qtyValueBox: {
        width: 100,
        height: 36,
        marginHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'silver',
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyValueText: {
        padding: 0,
        textAlign: 'center',
        fontSize: FontSize(20),
        fontWeight: 'bold',
        color: Colors.brandBlue,
    },
    remarksContainer: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderColor: 'silver',
        borderBottomWidth: 1,
    },
    remarksBox: {
        height: 100,
        borderWidth: 1,
        borderColor: 'gainsboro',
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'white',
    },
    remarksText: {
        fontSize: FontSize(17),
        color: 'black',
    },
    remarksPlaceholderText: {
        fontSize: FontSize(17),
        color: 'silver',
    },
    remarksModalContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 30,
    },
    remarksModalText: {
        height: 140,
        margin: 10,
        marginBottom: 2,
        borderWidth: 1,
        borderColor: 'silver',
        borderRadius: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: FontSize(17),
        color: 'black',
        backgroundColor: 'white',
    },
    remarksCountText: {
        textAlign: 'right',
        color: 'gray',
        fontSize: FontSize(13),
        paddingHorizontal: 12,
        paddingBottom: 6,
    },
    modalContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCard: {
        width: Sizing.windowsWidth * 0.92,
        maxHeight: Sizing.windowsHeight * 0.85,
        backgroundColor: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        borderWidth: 5,
        borderColor: Colors.brandBlue,
        paddingBottom: 5,
    },
    stockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 45,
        paddingHorizontal: 12,
        backgroundColor: Colors.listItemBackColor,
        marginBottom: 2,
    },
    stockWarehouseText: {
        flex: 1,
        color: Colors.brandBlue,
        fontSize: FontSize(16),
        fontWeight: 'bold',
    },
    stockQtyText: {
        color: 'black',
        fontSize: FontSize(16),
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: 'gray',
        fontSize: FontSize(16),
        padding: 20,
    },
    footer: {
        backgroundColor: 'gainsboro',
        height: 60,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        flexDirection: 'row',
    },
    button: {
        backgroundColor: Colors.brandBlue,
        width: 110,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
    },
    buttonText: {
        fontSize: FontSize(15),
        color: 'white',
    },
});

export default ReturnLineEditor;
