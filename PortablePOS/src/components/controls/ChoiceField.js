import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../variables/Colors';
import { FontSize } from '../../variables/ResponsiveFont';

// Tappable row with a ▼ hint (opens a list, settings, etc.) — same pattern as Print Label printer / design fields
const ChoiceField = ({ title, value, onPress, onLongPress, style, valueStyle }) => (
    <TouchableOpacity
        style={[styles.choiceField, style]}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress}>
        <View style={styles.choiceTextContainer}>
            <Text style={styles.choiceTitleText} numberOfLines={1}>{title}</Text>
            <Text style={[styles.choiceValueText, valueStyle]} numberOfLines={1}>{value}</Text>
        </View>
        {onPress ? <Text style={styles.choiceArrowText}>▼</Text> : null}
    </TouchableOpacity>
);

// Side-by-side choice fields (e.g. Printer + Design)
export const choiceRowStyle = StyleSheet.create({
    row: {
        flexDirection: 'row',
        height: 50,
        borderColor: 'silver',
        borderBottomWidth: 1,
    },
});

const styles = StyleSheet.create({
    choiceField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 50,
        backgroundColor: Colors.bgColor,
        paddingLeft: 10,
        paddingRight: 8,
        borderColor: 'silver',
        borderBottomWidth: 1,
        borderRightWidth: 1,
    },
    choiceTextContainer: {
        flex: 1,
    },
    choiceTitleText: {
        color: Colors.brandBlue,
        fontSize: FontSize(15),
        fontWeight: 'bold',
    },
    choiceValueText: {
        color: 'black',
        fontSize: FontSize(17),
    },
    choiceArrowText: {
        color: Colors.brandBlue,
        fontSize: FontSize(12),
        marginLeft: 4,
    },
});

// Title style reused outside the field (e.g. qty row on Print Label)
export const choiceTitleTextStyle = styles.choiceTitleText;

export default ChoiceField;
