export const ENDPOINTS = {
  auth: {
    login: "/auth/login/",
    logout: "/auth/logout/",
  },
  telemetry: {
    df: "/telemetry/df/",
    monitoring: "/telemetry/monitoring/",
    drone: "/telemetry/drone/",
    cellularActive: "/telemetry/cellular-active/",
    cellularPassive: "/telemetry/cellular-passive/",
    satellite: "/telemetry/satellite/",
  },
  sessions: {
    create: "/session/create/",
    stop: "/session/stop/",
    status: "/session/status/",
    list: "/session/list/",
  },
  sync: {
    start: "/sync/start/",
    export: "/sync/export/",
    overview: "/sync/status/",
    byNode: (id: string) => `/sync/status/node/${id}/`,
    byDrone: (id: string) => `/sync/status/drone/${id}/`,
    bySatellite: (id: string) => `/sync/status/satellite/${id}/`,
    byPassiveCellular: (id: string) => `/sync/status/passive-cellular/${id}/`,
    byActiveCellular: (id: string) => `/sync/status/active-cellular/${id}/`,
  },
  devices: {
    list: "/device/list/",
    regions: "/device/regions/",
    sensorLocations: "/device/sensorlist/",
    sensorLocationUpdate: (id: string) => `/device/sensor-locations/${id}/`,
    detail: (id: string) => `/device/${id}/`,
    types: "/device/types/",
    add: "/device/add/",
  },
  events: {
    list: "/events/",
    acknowledge: "/events/acknowledge/",
  },
  export: {
    csv: "/export/csv/",
  },
  notifications: {
    list: "/notifications/",
    detail: (id: string) => `/notifications/${id}/`,
    markRead: (id: string) => `/notifications/${id}/read/`,
    markAllRead: "/notifications/mark-all-read/",
  },
  system: {
    health: "/system/health/",
  },
  telemetryFiles: {
    list: "/telemetry/files/",
  },
  users: {
    list: "/auth/users/",
    detail: (id: number | string) => `/auth/users/${id}/`,
  },
} as const;
