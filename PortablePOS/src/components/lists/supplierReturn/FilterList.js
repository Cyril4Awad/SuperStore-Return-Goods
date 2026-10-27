import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, FlatList, TouchableOpacity, Modal } from 'react-native';
import Colors from '../../../variables/Colors';
import { FontSize } from '../../../variables/ResponsiveFont';
import ModalTitle from '../../ModalTitle';
import LoadingData from '../../LoadingData';

// Every word typed must be found in the search string of the row (the simple search of the stock search)
export const FilterRows = (rows, filterText, searchString) => {
    const words = filterText.trim().toUpperCase().split(' ').filter(word => word !== '');
    if (words.length === 0) return rows;
    return rows.filter(row => {
        const text = searchString(row);
        return words.every(word => text.indexOf(word) > -1);
    });
};

// All the rows (suppliers, returns of View, items of a scanned code) are listed, the box filters them as you type, a row is tapped to pick it
// props : visible, title, placeholder, rows, loading, error, onRetry, rowKey(row), rowTitle(row), rowDescription(row), rowInfo(row) (optional),
//         searchString(row) (upper case), onPick(row), onClose, footer (optional) : shown under the list (buttons)
const FilterList = props => {

    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        if (props.visible) setFilterText('');
    }, [props.visible]);

    if (!props.visible) return null;

    const rows = FilterRows(props.rows ?? [], filterText, props.searchString);

    const Row = ({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => props.onPick(item)}>
            <View style={styles.rowHeader}>
                <Text style={styles.rowTitleText} numberOfLines={1}>{props.rowTitle(item)}</Text>
                {props.rowInfo ? <Text style={styles.rowInfoText} numberOfLines={1}>{props.rowInfo(item)}</Text> : <></>}
            </View>
            <Text style={styles.rowDescriptionText} numberOfLines={2}>{props.rowDescription(item)}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={props.visible} onRequestClose={props.onClose}>
            <View style={styles.container}>

                <ModalTitle title={props.title} onCloseButtonPress={props.onClose} />

                <View style={styles.filterContainer}>
                    <TextInput
                        style={styles.filterText}
                        placeholder={props.placeholder}
                        maxLength={50}
                        value={filterText}
                        autoCapitalize='characters'
                        onChangeText={setFilterText}
                    />
                </View>

                {props.error ?
                    <TouchableOpacity onPress={props.onRetry}>
                        <Text style={styles.messageText}>{props.error}{props.onRetry ? '\nTap To Try Again' : ''}</Text>
                    </TouchableOpacity> :
                    <Text style={styles.countText}>{rows.length} / {(props.rows ?? []).length}</Text>}

                <FlatList
                    data={rows}
                    keyExtractor={props.rowKey}
                    renderItem={Row}
                    keyboardShouldPersistTaps='handled'
                    initialNumToRender={15}
                    windowSize={7}
                    ListEmptyComponent={props.loading || props.error ? <></> : <Text style={styles.messageText}>Nothing Found</Text>}
                />

                {props.footer ?? <></>}

                {props.loading ? <LoadingData /> : <></>}

            </View>
        </Modal>
    );
};

export const filterListStyles = StyleSheet.create({
    filterContainer: {
        width: '100%',
        height: 55,
        padding: 5,
    },
    filterText: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'silver',
        paddingLeft: 15,
        paddingVertical: 0,
        fontSize: FontSize(19),
        backgroundColor: 'white',
        color: 'black',
    },
    row: {
        minHeight: 55,
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: Colors.listItemBackColor,
        marginBottom: 2,
        justifyContent: 'center',
    },
    rowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowTitleText: {
        flex: 1,
        color: Colors.brandBlue,
        fontSize: FontSize(17),
        fontWeight: 'bold',
    },
    rowInfoText: {
        color: Colors.brandGreen,
        fontSize: FontSize(15),
        fontWeight: 'bold',
        marginLeft: 5,
    },
    rowDescriptionText: {
        color: 'black',
        fontSize: FontSize(15),
    },
    countText: {
        textAlign: 'right',
        color: 'gray',
        fontSize: FontSize(13),
        paddingHorizontal: 10,
        paddingBottom: 3,
    },
    messageText: {
        textAlign: 'center',
        color: 'gray',
        fontSize: FontSize(16),
        padding: 15,
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        backgroundColor: Colors.bgColor,
    },
    ...filterListStyles,
});

export default FilterList;
