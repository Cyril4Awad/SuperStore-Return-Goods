import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, FlatList, TouchableOpacity, Modal } from 'react-native';
import Colors from '../../../variables/Colors';
import { FontSize } from '../../../variables/ResponsiveFont';
import ModalTitle from '../../ModalTitle';
import LoadingData from '../../LoadingData';
import { FilterRows, filterListStyles } from './FilterList';

// The stock search (Category / Items of the portable) : all the items that can be returned are loaded once,
// Category lists the categories (the product groups of the data), a category opens its items, Items lists all the items,
// the box filters the list shown as you type (reference, barcode, description / category)
// supplierFilter (optional) : the items are opened filtered by it (the supplier of the return, "0162/"), it can be deleted
// props : visible, stockSearch { productGroups, items }, supplierFilter, loading, error, onRetry, onPick(item), onClose
const StockSearch = props => {

    const [itemsMode, setItemsMode] = useState(false);
    // The category opened : { code, description }
    const [productGroup, setProductGroup] = useState(null);
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        if (props.visible) {
            setProductGroup(null);
            setItemsMode(Boolean(props.supplierFilter));
            setFilterText(props.supplierFilter ?? '');
        }
    }, [props.visible]);

    // Closed : the items are not filtered at each change of the screen
    if (!props.visible) return null;

    const productGroups = props.stockSearch?.productGroups ?? [];
    const allItems = props.stockSearch?.items ?? [];

    const showItems = itemsMode || productGroup !== null;

    const listRows = showItems ?
        FilterRows(productGroup ? allItems.filter(item => item.productGroup === productGroup.code) : allItems,
            filterText, item => item.searchString) :
        FilterRows(productGroups, filterText, group => (group.code + ' ' + group.description).toUpperCase());

    // The items start filtered by the supplier, the categories are not
    const ChangeMode = (newItemsMode) => {
        setItemsMode(newItemsMode);
        setProductGroup(null);
        setFilterText(newItemsMode ? props.supplierFilter ?? '' : '');
    };

    const OpenProductGroup = (group) => {
        setProductGroup(group);
        setFilterText(props.supplierFilter ?? '');
    };

    // Back : from the items of a category to the categories, else closes
    const Back = () => {
        if (productGroup && !itemsMode) {
            setProductGroup(null);
            setFilterText('');
        } else {
            props.onClose();
        }
    };

    const ProductGroupRow = ({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => OpenProductGroup(item)}>
            <View style={styles.rowHeader}>
                <Text style={styles.rowTitleText} numberOfLines={1}>{item.description}</Text>
                <Text style={styles.rowInfoText}>{item.items}</Text>
            </View>
            <Text style={styles.rowDescriptionText}>{item.code}</Text>
        </TouchableOpacity>
    );

    const ItemRow = ({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => props.onPick(item)}>
            <View style={styles.rowHeader}>
                <Text style={styles.rowTitleText} numberOfLines={1}>{item.itemReference}</Text>
                <Text style={styles.rowInfoText} numberOfLines={1}>{item.barcode}</Text>
            </View>
            <Text style={styles.rowDescriptionText} numberOfLines={2}>{item.description}</Text>
        </TouchableOpacity>
    );

    const ModeButton = ({ title, selected, onPress }) => (
        <TouchableOpacity style={[styles.modeButton, selected ? styles.modeButtonSelected : null]} onPress={onPress}>
            <Text style={[styles.modeButtonText, selected ? styles.modeButtonTextSelected : null]}>{title}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={props.visible} onRequestClose={Back}>
            <View style={styles.container}>

                <ModalTitle title={productGroup && !itemsMode ? productGroup.description : 'Stock Search'} onCloseButtonPress={props.onClose} />

                <View style={styles.modeContainer}>
                    <ModeButton title='Category' selected={!itemsMode} onPress={() => ChangeMode(false)} />
                    <ModeButton title='Items' selected={itemsMode} onPress={() => ChangeMode(true)} />
                </View>

                {productGroup && !itemsMode ?
                    <TouchableOpacity style={styles.backRow} onPress={Back}>
                        <Text style={styles.backText}>‹ Category</Text>
                    </TouchableOpacity> :
                    <></>}

                <View style={styles.filterContainer}>
                    <TextInput
                        style={styles.filterText}
                        placeholder={showItems ? 'Search Items (Reference, Barcode, Description)' : 'Search Category'}
                        maxLength={50}
                        value={filterText}
                        autoCapitalize='characters'
                        onChangeText={setFilterText}
                    />
                </View>

                {props.error ?
                    <TouchableOpacity onPress={props.onRetry}>
                        <Text style={styles.messageText}>{props.error}{'\nTap To Try Again'}</Text>
                    </TouchableOpacity> :
                    <Text style={styles.countText}>{listRows.length} {showItems ? 'Items' : 'Categories'}</Text>}

                <FlatList
                    key={showItems ? 'items' : 'groups'}
                    data={listRows}
                    keyExtractor={showItems ? (item => item.itemRecID) : (group => group.code)}
                    renderItem={showItems ? ItemRow : ProductGroupRow}
                    keyboardShouldPersistTaps='handled'
                    initialNumToRender={15}
                    maxToRenderPerBatch={20}
                    windowSize={7}
                    ListEmptyComponent={props.loading || props.error ? <></> : <Text style={styles.messageText}>Nothing Found</Text>}
                />

                {props.loading ? <LoadingData /> : <></>}

            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        backgroundColor: Colors.bgColor,
    },
    modeContainer: {
        flexDirection: 'row',
        margin: 5,
        marginBottom: 0,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.brandBlue,
        overflow: 'hidden',
    },
    modeButton: {
        flex: 1,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    modeButtonSelected: {
        backgroundColor: Colors.brandBlue,
    },
    modeButtonText: {
        color: Colors.brandBlue,
        fontSize: FontSize(16),
        fontWeight: 'bold',
    },
    modeButtonTextSelected: {
        color: 'white',
    },
    backRow: {
        paddingHorizontal: 10,
        paddingTop: 6,
    },
    backText: {
        color: Colors.brandBlue,
        fontSize: FontSize(16),
        fontWeight: 'bold',
    },
    ...filterListStyles,
});

export default StockSearch;
