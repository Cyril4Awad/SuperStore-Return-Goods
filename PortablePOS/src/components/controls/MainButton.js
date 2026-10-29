import React from 'react';
import { View, StyleSheet, Text, TextInput, Image, TouchableOpacity } from 'react-native';
import Colors from '../../variables/Colors';
import Sizing from '../../variables/Sizing';
import { FontSize } from '../../variables/ResponsiveFont';

// imageSource (optional) : icon shown at the left of the title, the button is taller with an icon
// secondImageSource (optional) : a second icon next to the first one, both smaller so the title still fits
// style (optional) : style of the button container (e.g. its width when three buttons share a row)
// disabled (optional) : the button is faded and cannot be pressed
const MainButton = props => {

    const imageStyle = props.secondImageSource ? [styles.buttonImage, styles.buttonImageSmall] : styles.buttonImage;

    return (
        <View style={[styles.container, props.imageSource ? styles.containerWithImage : null, props.style, props.disabled ? styles.containerDisabled : null]}>
            <TouchableOpacity style={[styles.button, props.imageSource ? styles.buttonWithImage : null]} onPress={props.onPress} disabled={props.disabled}>
                {props.imageSource ?
                    <Image
                        source={props.imageSource}
                        style={imageStyle}
                        resizeMode="contain"
                    /> :
                    <></>}
                {props.secondImageSource ?
                    <Image
                        source={props.secondImageSource}
                        style={imageStyle}
                        resizeMode="contain"
                    /> :
                    <></>}
                <Text style={styles.buttonText} numberOfLines={1} adjustsFontSizeToFit={true} minimumFontScale={0.75}>{props.title}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: Sizing.isTablet ? '30%' : '49%',
        height: 40,
        marginBottom: 10,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: Colors.buttonBackColor2,
        borderWidth: 1,
        borderColor: Colors.buttonBorderColor,
    },
    containerWithImage: {
        height: 50,
    },
    containerDisabled: {
        opacity: 0.45,
    },
    button: {
        width : '100%',
        height : '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.buttonBackColor1,
    },
    buttonWithImage: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingLeft: 8,
        paddingRight: 5,
    },
    buttonImage: {
        width: 32,
        height: 32,
        marginRight: 6,
    },
    buttonImageSmall: {
        width: 24,
        height: 24,
        marginRight: 3,
    },
    buttonText: {
        fontSize: FontSize(18),
        color: Colors.buttonForeColor1,
        flexShrink: 1,
    },
});

export default MainButton;
