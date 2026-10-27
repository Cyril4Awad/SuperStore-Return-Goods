import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Colors from '../../variables/Colors';
import Sizing from '../../variables/Sizing';
import { FontSize } from '../../variables/ResponsiveFont';
import ModalTitle from '../ModalTitle';

// Number pad (return quantity), same card and footer as the app modals
// props : visible, title, decimals (0 = whole numbers), preview(value) => text, onSubmit(value), onCancel
// The value can be typed with the keypad of the device (Enter = OK) or with the keys on the screen
// With decimals the key C is the decimal point, a long press on < clears the value
const NumberPadModal = props => {

    const [value, setValue] = useState('');
    const inputRef = useRef();

    const decimals = props.decimals ?? 0;

    useEffect(() => {
        if (props.visible) setValue('');
    }, [props.visible]);

    // Digits (and one point followed by the decimals), at most 9 digits before the point
    const cleanValue = (text) => {
        const digits = text.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, '');
        const [whole, ...fractions] = digits.split('.');
        const wholePart = whole.replace(/^0+(?=[0-9])/, '').slice(0, 9);
        if (decimals === 0 || fractions.length === 0) return wholePart;
        return (wholePart === '' ? '0' : wholePart) + '.' + fractions.join('').slice(0, decimals);
    };

    const changeValue = (text) => setValue(cleanValue(text));

    const press = (key) => {
        if (key === 'C') setValue('');
        else if (key === '<') setValue(value.slice(0, -1));
        else setValue(cleanValue(value === '0' && key !== '.' ? key : value + key));
        // the keypad of the device keeps typing in the field
        inputRef.current?.focus();
    };

    const numericValue = () => decimals > 0 ? parseFloat(value) : parseInt(value, 10);

    const submit = () => {
        if (value !== '' && !isNaN(numericValue())) props.onSubmit(numericValue());
    };

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimals > 0 ? '.' : 'C', '0', '<'];

    return (
        <Modal visible={props.visible} transparent={true} presentationStyle="overFullScreen" onRequestClose={props.onCancel}>
            <View style={styles.modalContainer}>
                <View style={styles.modalCard}>

                    <ModalTitle title={props.title} onCloseButtonPress={props.onCancel} />

                    <View style={styles.valueContainer}>
                        <TextInput
                            ref={inputRef}
                            style={styles.valueText}
                            value={value}
                            placeholder='0'
                            placeholderTextColor='black'
                            onChangeText={changeValue}
                            keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
                            showSoftInputOnFocus={false}
                            autoFocus={true}
                            caretHidden={false}
                            maxLength={decimals > 0 ? 10 + decimals : 9}
                            blurOnSubmit={false}
                            onSubmitEditing={submit}
                        />
                        <Text style={styles.previewText}>{value !== '' && props.preview ? props.preview(numericValue()) : ' '}</Text>
                    </View>

                    <View style={styles.keysContainer}>
                        {keys.map(key => (
                            <TouchableOpacity key={key} style={styles.key} onPress={() => press(key)} onLongPress={key === '<' ? () => setValue('') : undefined}>
                                <Text style={[styles.keyText, { color: key === 'C' || key === '<' ? 'red' : Colors.brandBlue }]}>{key}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.button} onPress={props.onCancel}>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, { opacity: value === '' ? 0.4 : 1 }]} disabled={value === ''}
                            onPress={submit}>
                            <Text style={styles.buttonText}>OK</Text>
                        </TouchableOpacity>
                    </View>

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
        backgroundColor: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        borderWidth: 5,
        borderColor: Colors.brandBlue,
    },
    valueContainer: {
        alignItems: 'center',
        paddingTop: 8,
    },
    valueText: {
        width: '60%',
        fontSize: FontSize(32),
        color: 'black',
        fontWeight: 'bold',
        textAlign: 'center',
        padding: 0,
        borderBottomWidth: 2,
        borderBottomColor: Colors.brandBlue,
    },
    previewText: {
        fontSize: FontSize(15),
        color: Colors.brandGreen,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    keysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    key: {
        width: '31.5%',
        height: 52,
        marginBottom: 8,
        borderRadius: 15,
        backgroundColor: Colors.buttonBackColor1,
        borderWidth: 1,
        borderColor: Colors.buttonBorderColor,
        alignItems: 'center',
        justifyContent: 'center',
    },
    keyText: {
        fontSize: FontSize(24),
        fontWeight: 'bold',
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

export default NumberPadModal;
