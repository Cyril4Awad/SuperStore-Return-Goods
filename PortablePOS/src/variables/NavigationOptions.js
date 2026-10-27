import React from 'react';
import { Header, getHeaderTitle } from '@react-navigation/elements';
import Sizing from './Sizing';
import Colors from './Colors';
import { FontSize } from './ResponsiveFont';

const PORTABLE_HEADER_HEIGHT = 36;

export const portableScannerHeaderStyle = Sizing.isPortableScanner
    ? { height: PORTABLE_HEADER_HEIGHT }
    : {};

export const portableScannerHeaderExtraOptions = Sizing.isPortableScanner
    ? {
        headerStatusBarHeight: 0,
        headerTitleStyle: {
            fontSize: FontSize(14),
        },
    }
    : {};

export const baseHeaderScreenOptions = {
    headerStyle: {
        backgroundColor: Colors.brandBlue,
        ...portableScannerHeaderStyle,
    },
    headerTintColor: Colors.navTitleColor,
    ...portableScannerHeaderExtraOptions,
};

export function CompactStackHeader({ options, route, back, navigation }) {
    return (
        <Header
            {...options}
            title={getHeaderTitle(options, route.name)}
            back={back}
            navigation={navigation}
            headerStyle={{
                backgroundColor: Colors.brandBlue,
                height: PORTABLE_HEADER_HEIGHT,
            }}
            headerTitleStyle={{
                fontSize: FontSize(14),
            }}
            headerStatusBarHeight={0}
            headerTintColor={Colors.navTitleColor}
        />
    );
}

export const portableScannerStackScreenOptions = Sizing.isPortableScanner
    ? {
        header: (props) => <CompactStackHeader {...props} />,
    }
    : {};
