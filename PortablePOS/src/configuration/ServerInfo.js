import AsyncStorage from '@react-native-async-storage/async-storage';
import AppSettings from './AppSettings';

const serverStorageKey = '@app_server';

const ServerInfo = {

    serverURL: async () => {
        const saved = await AsyncStorage.getItem(serverStorageKey);
        const server = (saved && saved.trim()) || AppSettings.server;
        return 'http://' + server + '/SuperStoreReturnGoods_WS/dataservice.svc/Web/';
    },

    getServer: async () => {
        const saved = await AsyncStorage.getItem(serverStorageKey);
        return (saved && saved.trim()) || AppSettings.server;
    },

    setServer: async (server) => {
        await AsyncStorage.setItem(serverStorageKey, (server || '').trim());
    },

};

export default ServerInfo;
