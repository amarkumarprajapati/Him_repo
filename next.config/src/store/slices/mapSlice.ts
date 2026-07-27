import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const STORAGE_KEY = 'map_view_state';

interface MapViewState {
  center: [number, number];
  zoom: number;
  mapType: 'map' | 'satellite';
}

const DEFAULT_STATE: MapViewState = {
  center: [22.0, 78.0],
  zoom: 5,
  mapType: 'map',
};

function loadFromSession(): MapViewState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MapViewState;
      if (
        Array.isArray(parsed.center) &&
        parsed.center.length === 2 &&
        typeof parsed.zoom === 'number'
      ) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_STATE;
}

function saveToSession(state: MapViewState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const mapSlice = createSlice({
  name: 'map',
  initialState: loadFromSession(),
  reducers: {
    setMapView(state, action: PayloadAction<{ center: [number, number]; zoom: number }>) {
      state.center = action.payload.center;
      state.zoom = action.payload.zoom;
      saveToSession({ ...state });
    },
    setMapType(state, action: PayloadAction<'map' | 'satellite'>) {
      state.mapType = action.payload;
      saveToSession({ ...state });
    },
  },
});

export const { setMapView, setMapType } = mapSlice.actions;
export default mapSlice.reducer;
