import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// Loading animation over the screen while something takes time : no background, the screen stays visible behind it,
// but nothing can be pressed until it is done (the layer takes every touch)
const LoadingData = () => {

    return (
        <View style={styles.container} onStartShouldSetResponder={() => true}>
            <Image
                source={require('../assets/icons/loading.gif')}
                style={styles.image}
                resizeMode='contain'
            />
        </View>
    )
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        elevation: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: 150,
        height: 70,
    },
});

export default LoadingData;
