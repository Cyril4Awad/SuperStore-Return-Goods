import NetInfo from '@react-native-community/netinfo';
import { callService } from './ServiceCall';

let cachedOnline = false;
let cachedNetworkUp = true;
let lastCheckMs = 0;
const CHECK_INTERVAL_MS = 15000;
// The checks run one after the other : an old answer never replaces a newer one
let checkSequence = 0;

export const pingServer = () => callService('Ping', {}, 8000)
    .then(result => result === 'Success' || result === '"Success"')
    .catch(() => false);

// The test of the server form : resolves when the server answers the ping, else rejects with the reason
export const testServer = (server) => callService('Ping', {}, 8000, server)
    .then(result => {
        if (result !== 'Success' && result !== '"Success"') throw new Error(`The Server ${server} Sent An Invalid Answer.`);
    });

// Online : the server answers. The Wi-Fi of the store has no internet, so only the connection to the network counts
// (isInternetReachable would be false there), then the ping says if the server can be reached
export const refreshConnectivity = async () => {
    const sequence = ++checkSequence;
    const net = await NetInfo.fetch();
    const networkUp = net.isConnected === true;
    const serverUp = networkUp ? await pingServer() : false;
    if (sequence === checkSequence) {
        cachedOnline = serverUp;
        cachedNetworkUp = networkUp;
        lastCheckMs = Date.now();
    }
    return { isOnline: serverUp, networkUp, serverUp, isLatest: sequence === checkSequence };
};

export const getConnectivity = async (force = false) => {
    if (!force && Date.now() - lastCheckMs < CHECK_INTERVAL_MS) {
        return { isOnline: cachedOnline, networkUp: cachedNetworkUp, serverUp: cachedOnline };
    }
    return refreshConnectivity();
};

// listener({ isOnline, networkUp, serverUp }) when the network changes, and every CHECK_INTERVAL_MS
// (the Wi-Fi can be up before the server answers, the server can stop without the network changing)
export const subscribeConnectivity = (listener) => {
    const check = () => refreshConnectivity().then(state => {
        if (state.isLatest) listener(state);
    });
    const unsubscribe = NetInfo.addEventListener(check);
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    check();
    return () => {
        unsubscribe();
        clearInterval(timer);
    };
};
