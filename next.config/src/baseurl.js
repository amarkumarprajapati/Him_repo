const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
export const DEFAULT_BASE_URL = `http://${host}:30800/api`;

// Offline (localhost tileserver)
export const mapendpoint = {
    satellite: `http://${host}:30808/styles/indiaSatellite/{z}/{x}/{y}.png`,
    dark: `http://${host}:30808/styles/india/{z}/{x}/{y}.png`,
    light: `http://${host}:30808/styles/india/{z}/{x}/{y}.png`,
}

// Online
// export const mapendpoint = {
//     satellite: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
//     dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
//     light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
// }  