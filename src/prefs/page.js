import Adw from 'gi://Adw';

import { createLocationGroup } from './groups/location.js';
import { createPollingGroup } from './groups/polling.js';

export function buildPreferencesPage(settings) {
  const page = new Adw.PreferencesPage();
  page.add(createLocationGroup(settings));
  page.add(createPollingGroup(settings));
  return page;
}
