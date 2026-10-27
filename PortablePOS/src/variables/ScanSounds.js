import Sound from 'react-native-sound';

// Scan feedback : short beep when the item is found, two tones when it is not found
// Files are in android/app/src/main/res/raw

Sound.setCategory('Playback');

const loadSound = (fileName) => {
    const sound = new Sound(fileName, Sound.MAIN_BUNDLE, (error) => {
        if (error) {
            console.log('Cannot load sound ' + fileName, error);
        }
    });
    return sound;
};

const scanOkSound = loadSound('scan_ok.wav');
const scanErrorSound = loadSound('scan_error.wav');

const play = (sound) => {
    try {
        sound.stop(() => sound.play());
    } catch (error) {
        console.log(error);
    }
};

export const PlayScanOk = () => play(scanOkSound);

export const PlayScanError = () => play(scanErrorSound);
