import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Colors from '../variables/Colors';
import Sizing from '../variables/Sizing';
import { FontSize } from '../variables/ResponsiveFont';
import ModalTitle from './ModalTitle';

// The message box of the app (blue card + close X, like the download box), used instead of the Android alert
// MessageBox.alert(title, message, buttons) takes the same arguments as Alert.alert
// buttons : [{ text, style: 'cancel' | 'destructive', onPress }], OK when not given
// The X (and the back button) presses the cancel button, or the only button, otherwise just closes

let queue = [];
let refresh = null;

const Show = (title, message, buttons) => {
    queue = [...queue, {
        title: title ?? '',
        message: message === undefined || message === null ? '' : String(message),
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    }];
    if (refresh) refresh(queue[0]);
};

const MessageBox = {
    alert: (title, message, buttons) => Show(title, message, buttons),
};

// Mounted once at the root of the app
export const MessageBoxHost = () => {

    const [current, setCurrent] = useState(null);

    useEffect(() => {
        refresh = next => setCurrent(next ?? null);
        if (queue.length > 0) setCurrent(queue[0]);
        return () => { refresh = null; };
    }, []);

    const Close = (button) => {
        queue = queue.slice(1);
        setCurrent(queue[0] ?? null);
        if (button && button.onPress) button.onPress();
    };

    const CloseButton = () => {
        if (!current) return null;
        return current.buttons.find(button => button.style === 'cancel') ?? (current.buttons.length === 1 ? current.buttons[0] : null);
    };

    return (
        <Modal visible={current !== null} transparent={true} presentationStyle="overFullScreen" onRequestClose={() => Close(CloseButton())}>
            <View style={styles.modalContainer}>
                <View style={styles.modalCard}>

                    <ModalTitle title={current?.title === '' ? 'Message' : current?.title} onCloseButtonPress={() => Close(CloseButton())} />

                    <ScrollView style={styles.messageContainer} contentContainerStyle={styles.messageContent}>
                        <Text style={styles.messageText}>{current?.message}</Text>
                    </ScrollView>

                    <View style={styles.buttonsContainer}>
                        {(current?.buttons ?? []).map((button, index) =>
                            <TouchableOpacity key={index}
                                style={[styles.button, button.style === 'cancel' ? styles.buttonCancel : button.style === 'destructive' ? styles.buttonDestructive : null]}
                                onPress={() => Close(button)}>
                                <Text style={[styles.buttonText, button.style === 'cancel' ? styles.buttonCancelText : null]} numberOfLines={1}>{button.text}</Text>
                            </TouchableOpacity>
                        )}
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
        width: Sizing.windowsWidth * 0.9,
        maxHeight: Sizing.windowsHeight * 0.85,
        backgroundColor: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        borderWidth: 5,
        borderColor: Colors.brandBlue,
    },
    messageContainer: {
        flexGrow: 0,
    },
    messageContent: {
        padding: 20,
    },
    messageText: {
        fontSize: FontSize(17),
        color: 'black',
    },
    buttonsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
        paddingBottom: 15,
    },
    button: {
        backgroundColor: Colors.brandBlue,
        minWidth: 90,
        height: 40,
        paddingHorizontal: 12,
        marginHorizontal: 5,
        marginTop: 5,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
    },
    buttonCancel: {
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: Colors.brandBlue,
    },
    buttonDestructive: {
        backgroundColor: 'red',
    },
    buttonText: {
        fontSize: FontSize(15),
        color: 'white',
    },
    buttonCancelText: {
        color: Colors.brandBlue,
    },
});

export default MessageBox;
