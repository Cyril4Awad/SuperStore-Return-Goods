import {Dimensions} from 'react-native';
import { isTablet } from 'react-native-device-info';

//For Android the window dimension will exclude the size used by the status bar (if not translucent) and bottom navigation bar

const lcWindowsWidth = Dimensions.get('window').width;
const lcWindowsHeight = Dimensions.get('window').height;
const lcIsTablet = isTablet();//(Dimensions.get('window').width > 780);
const lcIsPortableScanner = (Dimensions.get('window').height < 510 && (Dimensions.get('window').width <= 780))

export default {
    windowsWidth : lcWindowsWidth,
    windowsHeight : lcWindowsHeight,
    isTablet : lcIsTablet,
    isPortableScanner : lcIsPortableScanner,
};