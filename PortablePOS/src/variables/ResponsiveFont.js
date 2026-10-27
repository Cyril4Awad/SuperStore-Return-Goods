import Sizing from "./Sizing";

export function FontSize(size) {

    if (Sizing.isPortableScanner) {
        return Math.round(((size / 7) * Sizing.windowsHeight) / 100);
    }
    else if (Sizing.isTablet) {
        return Math.round(((size / 17) * Sizing.windowsHeight) / 100);
    }
    else
    {
        return Math.round(((size / 10) * Sizing.windowsHeight) / 100);
    }
    
}