import React from 'react';
import { View, StyleSheet, Text, TextInput, Image, TouchableOpacity } from 'react-native';
import Colors from '../../variables/Colors';
import { FontSize } from '../../variables/ResponsiveFont';

const DataField = props => {

    return (
        <TouchableOpacity style={styles.container} onPress={props.onPress}>

            <View style={styles.fieldHeader}>

                <View style={styles.fieldTitle}>
                    <Text style={styles.fieldTitleText}>{props.title}</Text>
                </View>

                <View style={styles.fieldToolTip}>
                    <Text style={styles.fieldToolTipText}>{props.toolTip}</Text>
                </View>

            </View>

            <View style={styles.fieldData}>
                <Text style={styles.fieldDataText}>{props.data}</Text>
            </View>

        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.bgColor,
        height: 50,
        paddingLeft: 10,
        paddingRight: 10,
        borderColor : 'silver',
        borderBottomWidth : 1,
        overflow : 'hidden',
    },
    fieldHeader: {
        flexDirection: 'row',
        height : 20,
        width : '100%',
    },
    fieldTitle: {
        width : '50%',
        height : '100%',
        paddingLeft : 5,
        alignItems : 'flex-start',
        justifyContent : 'center',
    },
    fieldTitleText: {
        color : Colors.brandBlue,
        fontSize : FontSize(15),
        fontWeight : 'bold',
    },
    fieldToolTip: {
        width : '50%',
        height : '100%',
        paddingRight : 5,
        alignItems : 'flex-end',
        justifyContent : 'center',
    },
    fieldToolTipText: {
        color : 'silver',
        fontSize : FontSize(15),
        fontStyle : 'italic',
    },
    fieldData: {
        width : '100%',
        height : 30,
        paddingLeft : 5,
        alignItems : 'flex-start',
        justifyContent : 'center',
    },
    fieldDataText: {
        fontSize : FontSize(17),
        color : 'black',//Colors.brandBlue,
    },
});

export default DataField;
