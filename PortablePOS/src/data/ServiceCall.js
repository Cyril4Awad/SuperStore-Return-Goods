import DeviceInfo from "react-native-device-info";
import ServerInfo from "../configuration/ServerInfo";

// Calls a method of the web service of the server saved on the device (ServerInfo)

// The location sent on every call, taken from GetReturnSetup (Web.config of the IIS site)
let serviceLocation = '';

export const setServiceLocation = (location) => {
    serviceLocation = (location ?? '').trim();
};

// A call waits at most this time by default
const DEFAULT_TIMEOUT_MS = 30000;

// Returns the result string of the method, rejects with a clear message : the server cannot be reached,
// the server failed (HTTP error), it took too long, or the error of the method ("Error ..." of the web service)
// timeoutMs : stops waiting after that time (the request may still finish on the server)
export const callService = (method, body, timeoutMs = DEFAULT_TIMEOUT_MS) => {

    const request = ServerInfo.serverURL().then(serverURL => {

        const server = serverURL.replace(/^http:\/\//, '').split('/')[0];

        return fetch(serverURL + method,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    token: DeviceInfo.getDeviceNameSync() + "|" + DeviceInfo.getDeviceId() + "_" + DeviceInfo.getUniqueIdSync()
                },
                body: JSON.stringify({ location: serviceLocation, ...body })
            },
        )
            .catch(() => {
                throw new Error(`Cannot Reach The Server ${server}.\nCheck The Wi-Fi Connection Of The Device.`);
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`The Server ${server} Returned An Error (HTTP ${response.status}).\nCheck The Web Service SuperStoreReturnGoods_WS On IIS.`);
                }
                return response.json().catch(() => {
                    throw new Error(`The Server ${server} Sent An Invalid Answer.\nCheck The Web Service SuperStoreReturnGoods_WS On IIS.`);
                });
            })
            .then(results => {

                var strResult = results[method + 'Result'];

                if (strResult == null) {
                    throw new Error('No Answer From The Server ' + server);
                }

                if (strResult.startsWith('Error')) {
                    throw new Error(strResult.replace(/^Error /, ''));
                }

                return strResult;

            });

    });

    if (timeoutMs <= 0) return request;

    let timer;
    return Promise.race([
        request,
        new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('The Server Is Taking Too Long, Please Try Again')), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));

};
