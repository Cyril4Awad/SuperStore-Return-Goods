import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Colors from '../variables/Colors';
import Sizing from '../variables/Sizing';
import { FontSize } from '../variables/ResponsiveFont';
import ModalTitle from './ModalTitle';
import MainButton from './controls/MainButton';

let refresh = null;

// ProgressBox.show(title, bars, step, onCancel) : a bar under the other for each part of the work
// bars : [{ title, current, total }], total 0 : the total is not known yet (Please Wait)
// step : what is being done, shown under the bars
// onCancel (optional) : the Cancel button (also the X and the back key), not given when the work cannot be stopped anymore
export const ProgressBox = {
    show: (title, bars, step = '', onCancel = null) => {
        if (refresh) refresh({ title, bars, step, onCancel });
    },
    hide: () => {
        if (refresh) refresh(null);
    },
};

// 450500 -> 450,500
const formatCount = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const ProgressBar = ({ bar }) => {
    const known = bar.total > 0;
    const current = Math.min(Math.max(bar.current, 0), Math.max(bar.total, 1));
    const percent = known ? Math.floor((current / bar.total) * 100) : 0;
    const done = known && current >= bar.total;
    return (
        <View style={styles.bar}>
            <View style={styles.barHeader}>
                <Text style={[styles.barTitleText, done ? styles.doneText : null]} numberOfLines={1}>{bar.title}</Text>
                <Text style={[styles.barCountText, done ? styles.doneText : null]} numberOfLines={1}>
                    {known ? `${formatCount(current)} / ${formatCount(bar.total)}` : 'Please Wait...'}
                </Text>
            </View>
            <View style={styles.track}>
                <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
            <Text style={[styles.percentText, done ? styles.doneText : null]}>{done ? 'Done' : known ? `${percent}%` : ' '}</Text>
        </View>
    );
};

export const ProgressBoxHost = () => {
    const [progress, setProgress] = useState(null);

    useEffect(() => {
        refresh = setProgress;
        return () => { refresh = null; };
    }, []);

    if (!progress) return null;

    return (
        <Modal visible={true} transparent={true} presentationStyle="overFullScreen" onRequestClose={() => progress.onCancel?.()}>
            <View style={styles.modalContainer}>
                <View style={styles.modalCard}>
                    <ModalTitle title={progress.title} onCloseButtonPress={() => progress.onCancel?.()} />
                    <View style={styles.body}>
                        {(progress.bars ?? []).map(bar => <ProgressBar key={bar.title} bar={bar} />)}
                        {progress.step ? <Text style={styles.stepText}>{progress.step}</Text> : <></>}
                        {progress.onCancel ?
                            <MainButton title='Cancel' style={styles.cancelButton} imageSource={require('../assets/icons/close.png')} onPress={progress.onCancel} /> :
                            <></>}
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
        backgroundColor: 'white',
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
        borderWidth: 5,
        borderColor: Colors.brandBlue,
    },
    body: {
        padding: 16,
    },
    bar: {
        marginBottom: 10,
    },
    barHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 4,
    },
    barTitleText: {
        flexShrink: 1,
        fontSize: FontSize(15),
        color: '#555',
        marginRight: 8,
    },
    barCountText: {
        fontSize: FontSize(16),
        fontWeight: 'bold',
        color: Colors.brandBlue,
    },
    doneText: {
        color: Colors.brandGreen,
    },
    track: {
        height: 14,
        backgroundColor: 'gainsboro',
        borderRadius: 7,
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
        backgroundColor: Colors.brandGreen,
    },
    percentText: {
        marginTop: 2,
        fontSize: FontSize(13),
        color: '#555',
        textAlign: 'right',
    },
    stepText: {
        fontSize: FontSize(15),
        color: '#555',
        textAlign: 'center',
        marginTop: 2,
    },
    cancelButton: {
        marginTop: 12,
        alignSelf: 'center',
        width: '60%',
    },
});

export default ProgressBox;
