export const ORCA_STATUS_AREA_NAME = 'orca-dev-status';

export const SETTINGS_KEYS = Object.freeze({
  pollInterval: 'poll-interval-seconds',
  statusBarIndex: 'index-in-status-bar',
  statusBarLocation: 'location-in-status-bar',
});

export const LOCATION_BY_INDEX = Object.freeze({
  0: 'left',
  1: 'center',
  2: 'right',
});

export const ITEM_STATUS_ORDER = [
  'critical',
  'active',
  'waiting',
  'unknown',
  'finished',
];
