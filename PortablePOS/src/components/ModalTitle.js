import React from 'react';
import Sizing from '../variables/Sizing';
import Colors from '../variables/Colors';
import { FontSize } from '../variables/ResponsiveFont';
import { View, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';

const ModalTitle = props => {

    return (
        <View style={styles.container}>

            <View style={styles.headerTextContainer}>
                <Text style={styles.headerText} numberOfLines={1}>{props.title}</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={props.clearData} onPressOut={props.onCloseButtonPress}>
                    <Image
                        source={require('../assets/icons/close.png')}
                        style={styles.buttonImage}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        elevation: 15,
        width: '100%',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.brandBlue,
        flexDirection: 'row',
        
    },
    headerTextContainer: {
        //backgroundColor : 'red',
        width: '80%',
        height: '100%',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 20,
    },
    headerText: {
        color: Colors.navTitleColor,
        fontSize: FontSize(25),
        fontWeight: 'bold',
    },
    buttonContainer: {
        //backgroundColor: 'green',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        width: '20%',
        height: '100%',
        padding: 5,
    },
    button: {
        //backgroundColor: 'yellow',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 15,
        elevation: 5,
        //borderWidth: 2,
    },
    buttonImage: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        resizeMode: 'contain',
    },
});

export default ModalTitle;
