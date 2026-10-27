import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal, FlatList, Image } from 'react-native';
import Colors from '../../variables/Colors';
import Sizing from '../../variables/Sizing';
import { FontSize } from '../../variables/ResponsiveFont';
import ModalTitle from '../ModalTitle';

// List with check boxes (unit, warehouse of the return line)
// props : visible, title, options [{ code, description }], selected [codes], multiple, onSubmit(codes), onCancel
// multiple = false : one option, picked by tapping it
const OptionPicker = props => {

    const [checked, setChecked] = useState([]);
    const [searchString, setSearchString] = useState('');

    useEffect(() => {
        if (props.visible) {
            setChecked(props.selected ?? []);
            setSearchString('');
        }
    }, [props.visible]);

    const search = searchString.trim().toUpperCase();
    const options = search === '' ? props.options :
        props.options.filter(option => option.description.toUpperCase().includes(search) || option.code.toUpperCase().includes(search));

    const Press = (code) => {
        if (!props.multiple) {
            props.onSubmit([code]);
            return;
        }
        setChecked(current => current.includes(code) ? current.filter(value => value !== code) : [...current, code]);
    };

    const OptionRow = ({ item }) => (
        <TouchableOpacity style={styles.optionRow} onPress={() => Press(item.code)}>
            <View style={styles.optionTextContainer}>
                <Text style={styles.optionText} numberOfLines={2}>{item.description || item.code}</Text>
            </View>
            <Image
                source={checked.includes(item.code) ? require('../../assets/icons/checked.png') : require('../../assets/icons/unchecked.png')}
                style={styles.checkBoxImage}
                resizeMode='contain'
            />
        </TouchableOpacity>
    );

    return (
        <Modal visible={props.visible} transparent={true} presentationStyle="overFullScreen" onRequestClose={props.onCancel}>
            <View style={styles.modalContainer}>
                <View style={styles.modalCard}>

                    <ModalTitle title={props.title} onCloseButtonPress={props.onCancel} />

                    {props.options.length > 8 ?
                        <View style={styles.searchContainer}>
                            <TextInput
                                style={styles.searchText}
                                placeholder='Search'
                                maxLength={30}
                                value={searchString}
                                onChangeText={setSearchString}
                            />
                        </View> :
                        <></>}

                    <FlatList
                        data={options}
                        keyExtractor={(item) => item.code}
                        renderItem={OptionRow}
                        keyboardShouldPersistTaps='handled'
                        ListEmptyComponent={<Text style={styles.emptyText}>Nothing Found</Text>}
                    />

                    {props.multiple ?
                        <View style={styles.footer}>
                            <TouchableOpacity style={[styles.button, { backgroundColor: 'red' }]} onPress={() => setChecked([])}>
                                <Text style={styles.buttonText}>Clear</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.button} onPress={() => props.onSubmit(checked)}>
                                <Text style={styles.buttonText}>OK{checked.length > 0 ? ` (${checked.length})` : ''}</Text>
                            </TouchableOpacity>
                        </View> :
                        <></>}

                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
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
    },
    searchContainer: {
        width: '100%',
        height: 50,
        padding: 5,
    },
    searchText: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderColor: 'silver',
        paddingLeft: 15,
        fontSize: FontSize(18),
        backgroundColor: 'white',
        color: 'black',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 50,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: Colors.listItemBackColor,
        marginBottom: 2,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionText: {
        color: Colors.brandBlue,
        fontSize: FontSize(17),
        fontWeight: 'bold',
    },
    checkBoxImage: {
        width: 30,
        height: 30,
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

export default OptionPicker;
